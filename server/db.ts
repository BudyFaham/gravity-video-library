import { and, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, LoginAttempt, InsertLoginAttempt, loginAttempts, users, loginRequests, gravitySessions, LoginRequest, GravitySession, InsertGravitySession, customVideos, CustomVideo, InsertCustomVideo } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId }; const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } }
  values.lastSignedIn = user.lastSignedIn ?? new Date(); updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function recordLoginAttempt(attempt: InsertLoginAttempt) { const db = await getDb(); if (!db) return; await db.insert(loginAttempts).values(attempt); }
export async function getRecentLoginAttempts(limit = 100): Promise<LoginAttempt[]> { const db = await getDb(); if (!db) return []; return db.select().from(loginAttempts).orderBy(desc(loginAttempts.createdAt)).limit(limit); }
export async function getLoginAttemptSummary() { const db = await getDb(); if (!db) return { total: 0, successful: 0, failed: 0, pending: 0 }; const rows = await db.select({ total: sql<number>`count(*)`, successful: sql<number>`coalesce(sum(case when ${loginAttempts.successful} = 1 then 1 else 0 end), 0)`, pending: sql<number>`coalesce(sum(case when ${loginAttempts.reason} = 'awaiting_approval' then 1 else 0 end), 0)` }).from(loginAttempts).where(and(ne(loginAttempts.reason, "admin_login"), ne(loginAttempts.reason, "invalid_admin_credentials"), ne(loginAttempts.displayName, "(الإدارة)"))); const row = rows[0] ?? { total: 0, successful: 0, pending: 0 }; return { total: Number(row.total), successful: Number(row.successful), failed: Number(row.total) - Number(row.successful) - Number(row.pending), pending: Number(row.pending) }; }
export async function deleteLoginAttempt(id: number) { const db = await getDb(); if (!db) return; await db.delete(loginAttempts).where(eq(loginAttempts.id, id)); }
export async function deleteAllLoginAttempts() { const db = await getDb(); if (!db) return; await db.delete(loginAttempts); }
export async function deleteAdminLoginAttempts() { const db = await getDb(); if (!db) return; await db.delete(loginAttempts).where(or(eq(loginAttempts.reason, "admin_login"), eq(loginAttempts.reason, "invalid_admin_credentials"), eq(loginAttempts.displayName, "(الإدارة)"))); }

export async function createLoginRequest(request: typeof loginRequests.$inferInsert) { const db = await getDb(); if (!db) return; await db.insert(loginRequests).values(request); }
export async function getLoginRequest(id: string): Promise<LoginRequest | undefined> { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(loginRequests).where(eq(loginRequests.id, id)).limit(1); return rows[0]; }
export async function getPendingLoginRequests(): Promise<LoginRequest[]> { const db = await getDb(); if (!db) return []; return db.select().from(loginRequests).where(eq(loginRequests.status, "pending")).orderBy(desc(loginRequests.createdAt)).limit(100); }
export async function resolveLoginRequest(id: string, status: "approved" | "denied", denialMessage?: string) { const db = await getDb(); if (!db) return; await db.update(loginRequests).set({ status, denialMessage: denialMessage || null, resolvedAt: new Date() }).where(and(eq(loginRequests.id, id), eq(loginRequests.status, "pending"))); }

export async function createGravitySession(session: InsertGravitySession) { const db = await getDb(); if (!db) return; await db.insert(gravitySessions).values(session); }
export async function getActiveGravitySessions(): Promise<GravitySession[]> { const db = await getDb(); if (!db) return []; return db.select().from(gravitySessions).where(and(eq(gravitySessions.status, "active"), isNull(gravitySessions.revokedAt), gt(gravitySessions.expiresAt, new Date()))).orderBy(desc(gravitySessions.createdAt)).limit(100); }
export async function getGravitySessionHistory(): Promise<GravitySession[]> { const db = await getDb(); if (!db) return []; return db.select().from(gravitySessions).orderBy(desc(gravitySessions.createdAt)).limit(100); }
export async function endGravitySession(id: string, endReason: "logout" | "admin_terminated") { const db = await getDb(); if (!db) return; await db.update(gravitySessions).set({ status: endReason === "logout" ? "logged_out" : "terminated", endReason, endedAt: new Date(), revokedAt: endReason === "admin_terminated" ? new Date() : null }).where(eq(gravitySessions.id, id)); }
export async function revokeGravitySession(id: string) { await endGravitySession(id, "admin_terminated"); }
export async function revokeAllGravitySessions() { const db = await getDb(); if (!db) return; await db.update(gravitySessions).set({ status: "terminated", endReason: "admin_terminated", endedAt: new Date(), revokedAt: new Date() }).where(and(eq(gravitySessions.status, "active"), isNull(gravitySessions.revokedAt))); }
export async function isGravitySessionRevoked(id: string) { const db = await getDb(); if (!db) return false; const rows = await db.select({ id: gravitySessions.id }).from(gravitySessions).where(and(eq(gravitySessions.id, id), eq(gravitySessions.status, "active"), isNull(gravitySessions.revokedAt), gt(gravitySessions.expiresAt, new Date()))).limit(1); return rows.length === 0; }

export async function getCustomVideos(): Promise<CustomVideo[]> { const db = await getDb(); if (!db) return []; return db.select().from(customVideos).orderBy(customVideos.sortOrder, desc(customVideos.createdAt)); }
export async function createCustomVideo(video: InsertCustomVideo): Promise<void> { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(customVideos).values(video); }
export async function deleteCustomVideo(id: string): Promise<void> { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(customVideos).where(eq(customVideos.id, id)); }
