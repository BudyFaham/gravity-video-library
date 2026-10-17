import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { createLoginRequest, createGravitySession, createCustomVideo, deleteAdminLoginAttempts, deleteAllLoginAttempts, deleteCustomVideo, deleteLoginAttempt, endGravitySession, getActiveGravitySessions, getCustomVideos, getGravitySessionHistory, getLoginAttemptSummary, getLoginRequest, getPendingLoginRequests, getRecentLoginAttempts, isGravitySessionRevoked, recordLoginAttempt, resolveLoginRequest, revokeAllGravitySessions, revokeGravitySession } from "./db";
import { createAdminGravitySessionToken, createGravitySessionToken, getAdminGravitySessionCookie, getExpiredAdminGravitySessionCookie, getExpiredGravitySessionCookie, getGravitySessionCookie, getGravitySessionExpiry, getGravitySessionId, isAdminGravitySessionToken, isValidGravityAdminCredentials, isValidGravityCredentials, readAdminGravitySessionCookie, readGravitySessionCookie } from "./gravityAuth";

type FailureBucket = { count: number; resetAt: number };
type RequestRecord = { id: string; displayName: string; username: string; ipAddress: string; userAgent: string | null; remember: number; status: string; denialMessage: string | null; createdAt: Date; resolvedAt: Date | null };
const failures = new Map<string, FailureBucket>();
const fallbackAttempts: Array<Record<string, unknown>> = [];
const fallbackRequests = new Map<string, RequestRecord>();
const fallbackSessions = new Map<string, { id: string; displayName: string; username: string; ipAddress: string; userAgent: string | null; remember: number; status: string; endReason: string | null; expiresAt: Date; revokedAt: Date | null; endedAt: Date | null; createdAt: Date }>();
const MAX_FAILURES = 8; const WINDOW_MS = 15 * 60 * 1000;
function clientKey(req: Request) { return req.ip || req.socket.remoteAddress || "unknown"; }
function isRateLimited(req: Request) { const now = Date.now(); const key = clientKey(req); const bucket = failures.get(key); if (!bucket || bucket.resetAt <= now) { failures.set(key, { count: 0, resetAt: now + WINDOW_MS }); return false; } return bucket.count >= MAX_FAILURES; }
function recordFailure(req: Request) { const key = clientKey(req); const now = Date.now(); const bucket = failures.get(key); if (!bucket || bucket.resetAt <= now) failures.set(key, { count: 1, resetAt: now + WINDOW_MS }); else bucket.count += 1; }
function clearFailures(req: Request) { failures.delete(clientKey(req)); }
function isSecureRequest(req: Request) { return req.secure || req.headers["x-forwarded-proto"] === "https"; }
function noStore(res: Response) { res.setHeader("Cache-Control", "no-store"); }
function cookieToken(req: Request) { return readGravitySessionCookie(req.headers.cookie); }
function adminCookieToken(req: Request) { return readAdminGravitySessionCookie(req.headers.cookie); }
async function isAuthenticated(req: Request) { const token = cookieToken(req); if (!token) return false; const sessionId = getGravitySessionId(token); if (!sessionId) return false; return !(await isGravitySessionRevoked(sessionId)); }
async function isAdminAuthenticated(req: Request) { return isAdminGravitySessionToken(adminCookieToken(req)); }
async function logAttempt(req: Request, username: string, displayName: string, successful: boolean, reason: string, source?: { ipAddress?: string; userAgent?: string | null }) { const entry = { displayName: displayName.slice(0, 128) || "(بدون اسم)", username: username.slice(0, 128) || "(empty)", ipAddress: source?.ipAddress || clientKey(req), successful: successful ? 1 : 0, reason, userAgent: source?.userAgent?.slice(0, 500) || req.get("user-agent")?.slice(0, 500) || null, createdAt: new Date() }; fallbackAttempts.unshift(entry); fallbackAttempts.splice(100); try { await recordLoginAttempt(entry); } catch (error) { console.warn("[Auth] Could not persist login attempt:", error); } }
function newRequestId() { return `req_${Date.now()}_${randomBytes(18).toString("hex")}`; }
const VIDEO_CATEGORIES = new Set(["شرح", "حل إمتحان جزئي", "حل إمتحان شامل", "أساسيات"]);
const VIDEO_SECTIONS = new Set(["الشرح", "الحل", "الاختبارات الجزئية", "الامتحانات الشاملة"]);
function parseVideoPayload(body: unknown) {
  const input = body as Record<string, unknown> | null;
  const id = typeof input?.id === "string" ? input.id.trim().replace(/.*(?:youtu\.be\/|v=|embed\/)/, "").split(/[?&]/)[0] : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const category = typeof input?.category === "string" ? input.category : "";
  const section = typeof input?.section === "string" ? input.section : "";
  const lesson = typeof input?.lesson === "string" ? input.lesson.trim() : "فيديو جديد";
  const duration = typeof input?.duration === "string" ? input.duration.trim() : "";
  const solutionGroup = typeof input?.solutionGroup === "string" ? input.solutionGroup.trim() : null;
  const description = typeof input?.description === "string" ? input.description.trim().slice(0, 2000) : null;
  const homework = Array.isArray(input?.homework) ? input.homework.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 50) : [];
  const sortOrder = Number.isInteger(input?.sortOrder) ? Number(input?.sortOrder) : 0;
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id) || !title || title.length > 255 || !VIDEO_CATEGORIES.has(category) || !VIDEO_SECTIONS.has(section) || !duration || duration.length > 32 || !Number.isSafeInteger(sortOrder)) return null;
  return { id, title, category, lesson: lesson.slice(0, 255), section, solutionGroup: section === "الحل" ? solutionGroup : null, duration, homework: JSON.stringify(homework), description, sortOrder };
}

export function registerGravityAuthRoutes(app: Express) {
  void deleteAdminLoginAttempts().catch(() => undefined);
  app.get("/api/auth/session", async (req, res) => { noStore(res); const authenticated = await isAuthenticated(req); res.status(authenticated ? 200 : 401).json({ authenticated }); });

  app.get("/api/videos/custom", async (_req, res) => {
    noStore(res);
    try {
      const rows = await getCustomVideos();
      res.json({ videos: rows.map(video => ({ ...video, homework: JSON.parse(video.homework || "[]") })) });
    } catch { res.status(503).json({ error: "Video service unavailable" }); }
  });

  app.post("/api/videos/custom", async (req, res) => {
    noStore(res);
    if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Admin authentication required" }); return; }
    const video = parseVideoPayload(req.body);
    if (!video) { res.status(400).json({ error: "Invalid video payload" }); return; }
    try { await createCustomVideo(video); res.status(201).json({ ok: true }); } catch { res.status(409).json({ error: "Video already exists or could not be saved" }); }
  });

  app.delete("/api/videos/custom/:id", async (req, res) => {
    noStore(res);
    if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Admin authentication required" }); return; }
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(req.params.id)) { res.status(400).json({ error: "Invalid video id" }); return; }
    try { await deleteCustomVideo(req.params.id); res.json({ ok: true }); } catch { res.status(503).json({ error: "Video service unavailable" }); }
  });

  app.post("/api/auth/login", async (req, res) => {
    noStore(res); const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : ""; const username = typeof req.body?.username === "string" && req.body.username.trim() ? req.body.username.trim() : (process.env.GRAVITY_AUTH_USERNAME ?? ""); const password = typeof req.body?.password === "string" ? req.body.password : ""; const remember = req.body?.remember === true;
    if (!displayName) { await logAttempt(req, username, "(بدون اسم)", false, "missing_name"); res.status(400).json({ error: "Name is required" }); return; }
    if (isRateLimited(req)) { await logAttempt(req, username, displayName, false, "rate_limited"); res.status(429).json({ error: "Too many attempts. Try again later." }); return; }
    if (!isValidGravityCredentials(username, password)) { recordFailure(req); await logAttempt(req, username, displayName, false, "invalid_credentials"); res.status(401).json({ error: "Invalid credentials" }); return; }
    clearFailures(req); const id = newRequestId(); const request = { id, displayName, username, ipAddress: clientKey(req), userAgent: req.get("user-agent")?.slice(0, 500) || null, remember: remember ? 1 : 0, status: "pending" as const, createdAt: new Date() };
    fallbackRequests.set(id, { ...request, denialMessage: null, resolvedAt: null }); try { await createLoginRequest(request); } catch (error) { console.warn("[Auth] Could not persist login request:", error); }
    await logAttempt(req, username, displayName, false, "awaiting_approval"); res.status(202).json({ pending: true, requestId: id });
  });

  app.get("/api/auth/request/:id", async (req, res) => {
    noStore(res); const id = req.params.id; const dbRequest = await getLoginRequest(id).catch(() => undefined); const request = dbRequest ?? fallbackRequests.get(id);
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status === "approved") { const token = createGravitySessionToken(Boolean(request.remember)); const sessionId = getGravitySessionId(token)!; const session = { id: sessionId, displayName: request.displayName, username: request.username, ipAddress: request.ipAddress, userAgent: request.userAgent, remember: request.remember, status: "active" as const, endReason: null, expiresAt: getGravitySessionExpiry(token), revokedAt: null, endedAt: null, createdAt: new Date() }; fallbackSessions.set(sessionId, { ...session }); try { await createGravitySession(session); } catch (error) { console.warn("[Auth] Could not persist session:", error); } await logAttempt(req, request.username, request.displayName, true, request.remember ? "login_remembered" : "login"); res.setHeader("Set-Cookie", getGravitySessionCookie(token, isSecureRequest(req), Boolean(request.remember))); res.json({ status: "approved", authenticated: true }); return; }
    res.json({ status: request.status, message: request.denialMessage || undefined });
  });

  app.post("/api/auth/logout", async (req, res) => { noStore(res); const token = cookieToken(req); const sessionId = getGravitySessionId(token); if (sessionId) { const session = fallbackSessions.get(sessionId); if (session) { session.status = "logged_out"; session.endReason = "logout"; session.endedAt = new Date(); session.revokedAt = null; } await endGravitySession(sessionId, "logout").catch(() => undefined); } res.setHeader("Set-Cookie", getExpiredGravitySessionCookie(isSecureRequest(req))); res.status(200).json({ authenticated: false }); });

  app.post("/api/auth/admin/login", async (req, res) => {
    noStore(res); const username = typeof req.body?.username === "string" ? req.body.username.trim() : ""; const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!isValidGravityAdminCredentials(username, password)) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = createAdminGravitySessionToken(true);
    res.setHeader("Set-Cookie", getAdminGravitySessionCookie(token, isSecureRequest(req))); res.json({ authenticated: true });
  });
  app.post("/api/auth/admin/logout", async (req, res) => { noStore(res); res.setHeader("Set-Cookie", getExpiredAdminGravitySessionCookie(isSecureRequest(req))); res.json({ authenticated: false }); });

  app.get("/api/auth/admin/attempts", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } try { const attempts = await getRecentLoginAttempts(100); res.json({ attempts: attempts.length ? attempts.filter(item => item.reason !== "admin_login" && item.reason !== "invalid_admin_credentials" && item.displayName !== "(الإدارة)") : fallbackAttempts.filter(item => item.reason !== "admin_login" && item.reason !== "invalid_admin_credentials" && item.displayName !== "(الإدارة)") }); } catch { res.json({ attempts: fallbackAttempts.filter(item => item.reason !== "admin_login" && item.reason !== "invalid_admin_credentials" && item.displayName !== "(الإدارة)") }); } });
  app.get("/api/auth/admin/dashboard", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } const [attemptResult, summaryResult, requestResult, sessionResult, historyResult] = await Promise.allSettled([getRecentLoginAttempts(100), getLoginAttemptSummary(), getPendingLoginRequests(), getActiveGravitySessions(), getGravitySessionHistory()]); const cleanAttempts = (items: Array<{ reason: string; displayName: string; successful?: number }>) => items.filter(item => item.reason !== "admin_login" && item.reason !== "invalid_admin_credentials" && item.displayName !== "(الإدارة)"); const fallbackRequestRows = Array.from(fallbackRequests.values()).filter(item => item.status === "pending"); const fallbackSessionRows = Array.from(fallbackSessions.values()).filter(s => s.status === "active" && !s.revokedAt && s.expiresAt > new Date()); const fallbackHistoryRows = Array.from(fallbackSessions.values()); const attempts = attemptResult.status === "fulfilled" ? cleanAttempts(attemptResult.value) : cleanAttempts(fallbackAttempts as Array<{ reason: string; displayName: string; successful?: number }>); const summary = summaryResult.status === "fulfilled" ? summaryResult.value : { total: attempts.length, successful: attempts.filter(item => item.successful === 1).length, pending: attempts.filter(item => item.reason === "awaiting_approval").length, failed: attempts.filter(item => item.successful !== 1 && item.reason !== "awaiting_approval").length }; res.json({ attempts, summary, requests: requestResult.status === "fulfilled" && requestResult.value.length ? requestResult.value : fallbackRequestRows, sessions: sessionResult.status === "fulfilled" ? sessionResult.value : fallbackSessionRows, sessionHistory: historyResult.status === "fulfilled" ? historyResult.value : fallbackHistoryRows }); });
  app.delete("/api/auth/admin/attempts/:id", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } const id = Number(req.params.id); if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid attempt id" }); return; } await deleteLoginAttempt(id).catch(() => undefined); res.json({ ok: true }); });
  app.delete("/api/auth/admin/attempts", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } await deleteAllLoginAttempts().catch(() => undefined); fallbackAttempts.splice(0, fallbackAttempts.length); res.json({ ok: true }); });
  app.get("/api/auth/admin/requests", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } try { const requests = await getPendingLoginRequests(); res.json({ requests: requests.length ? requests : Array.from(fallbackRequests.values()).filter(item => item.status === "pending") }); } catch { res.json({ requests: Array.from(fallbackRequests.values()).filter(item => item.status === "pending") }); } });
  app.post("/api/auth/admin/requests/:id/approve", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } const id = req.params.id; await resolveLoginRequest(id, "approved").catch(() => undefined); const item = fallbackRequests.get(id); if (item) item.status = "approved"; res.json({ ok: true }); });
  app.post("/api/auth/admin/requests/:id/deny", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 500) : "تم رفض الطلب."; const id = req.params.id; const request = await getLoginRequest(id).catch(() => undefined) ?? fallbackRequests.get(id); await resolveLoginRequest(id, "denied", message).catch(() => undefined); const item = fallbackRequests.get(id); if (item) { item.status = "denied"; item.denialMessage = message; } if (request) await logAttempt(req, request.username, request.displayName, false, "denied", { ipAddress: request.ipAddress, userAgent: request.userAgent }); res.json({ ok: true }); });
  app.get("/api/auth/admin/sessions", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } try { const sessions = await getActiveGravitySessions(); res.json({ sessions: sessions.length ? sessions : Array.from(fallbackSessions.values()).filter(s => !s.revokedAt && s.expiresAt > new Date()) }); } catch { res.json({ sessions: Array.from(fallbackSessions.values()).filter(s => !s.revokedAt && s.expiresAt > new Date()) }); } });
  app.post("/api/auth/admin/sessions/:id/revoke", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } const id = req.params.id; await revokeGravitySession(id).catch(() => undefined); const session = fallbackSessions.get(id); if (session) session.revokedAt = new Date(); res.json({ ok: true }); });
  app.post("/api/auth/admin/sessions/revoke-all", async (req, res) => { noStore(res); if (!(await isAdminAuthenticated(req))) { res.status(401).json({ error: "Unauthorized" }); return; } await revokeAllGravitySessions().catch(() => undefined); Array.from(fallbackSessions.values()).forEach(session => { session.revokedAt = new Date(); }); res.json({ ok: true }); });
}
