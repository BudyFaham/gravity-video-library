import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "gravity_session";
const ADMIN_SESSION_COOKIE = "gravity_admin_session";
const STANDARD_TTL_SECONDS = 60 * 60 * 8;
const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30;
type SessionPayload = { id: string; exp: number; remember: boolean; admin?: boolean };
function getConfiguredValue(key: "GRAVITY_AUTH_USERNAME" | "GRAVITY_AUTH_PASSWORD" | "GRAVITY_ADMIN_USERNAME" | "GRAVITY_ADMIN_PASSWORD") { return process.env[key] ?? ""; }
function getSigningSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  return secret;
}
function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function sign(value: string) { return createHmac("sha256", getSigningSecret()).update(value).digest("base64url"); }
export function isValidGravityCredentials(username: string, password: string) { const expectedUsername = getConfiguredValue("GRAVITY_AUTH_USERNAME"); const expectedPassword = getConfiguredValue("GRAVITY_AUTH_PASSWORD"); if (!expectedUsername || !expectedPassword || username.length !== expectedUsername.length || password.length !== expectedPassword.length) return false; return timingSafeEqual(Buffer.from(username), Buffer.from(expectedUsername)) && timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword)); }
export function isValidGravityAdminCredentials(username: string, password: string) { const expectedUsername = getConfiguredValue("GRAVITY_ADMIN_USERNAME"); const expectedPassword = getConfiguredValue("GRAVITY_ADMIN_PASSWORD"); if (!expectedUsername || !expectedPassword || username.length !== expectedUsername.length || password.length !== expectedPassword.length) return false; return timingSafeEqual(Buffer.from(username), Buffer.from(expectedUsername)) && timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword)); }
function createSessionToken(remember: boolean, admin: boolean) { const ttl = remember ? REMEMBER_TTL_SECONDS : STANDARD_TTL_SECONDS; const payload: SessionPayload = { id: randomBytes(24).toString("base64url"), exp: Math.floor(Date.now() / 1000) + ttl, remember, admin }; const encodedPayload = encode(JSON.stringify(payload)); return `${encodedPayload}.${sign(encodedPayload)}`; }
export function createGravitySessionToken(remember = false) { return createSessionToken(remember, false); }
export function createAdminGravitySessionToken(remember = true) { return createSessionToken(remember, true); }
export function getGravitySessionId(token: string | undefined) { if (!token) return undefined; try { const [encoded] = token.split("."); return (JSON.parse(decode(encoded)) as SessionPayload).id; } catch { return undefined; } }
export function isAdminGravitySessionToken(token: string | undefined) { if (!isValidGravitySessionToken(token)) return false; try { const [encoded] = token!.split("."); return Boolean((JSON.parse(decode(encoded)) as SessionPayload).admin); } catch { return false; } }
export function getGravitySessionExpiry(token: string) { try { return new Date((JSON.parse(decode(token.split(".")[0])) as SessionPayload).exp * 1000); } catch { return new Date(Date.now()); } }
export function isValidGravitySessionToken(token: string | undefined) { if (!token) return false; const [encodedPayload, providedSignature] = token.split("."); if (!encodedPayload || !providedSignature) return false; const expectedSignature = sign(encodedPayload); if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) return false; try { const payload = JSON.parse(decode(encodedPayload)) as SessionPayload; return Boolean(payload.id) && Number.isFinite(payload.exp) && payload.exp > Math.floor(Date.now() / 1000); } catch { return false; } }
export function getGravitySessionCookieName() { return SESSION_COOKIE; }
export function getGravitySessionCookie(token: string, secure = process.env.NODE_ENV === "production", remember = false) { const maxAge = remember ? REMEMBER_TTL_SECONDS : STANDARD_TTL_SECONDS; return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`; }
export function getExpiredGravitySessionCookie(secure = process.env.NODE_ENV === "production") { return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`; }
export function readGravitySessionCookie(cookieHeader: string | undefined) { const token = cookieHeader?.split(";").map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1); return isValidGravitySessionToken(token) ? token : undefined; }
export function getAdminGravitySessionCookie(token: string, secure = process.env.NODE_ENV === "production") { return `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${REMEMBER_TTL_SECONDS}; SameSite=Lax${secure ? "; Secure" : ""}`; }
export function getExpiredAdminGravitySessionCookie(secure = process.env.NODE_ENV === "production") { return `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`; }
export function readAdminGravitySessionCookie(cookieHeader: string | undefined) { const token = cookieHeader?.split(";").map(part => part.trim()).find(part => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))?.slice(ADMIN_SESSION_COOKIE.length + 1); return isValidGravitySessionToken(token) ? token : undefined; }
