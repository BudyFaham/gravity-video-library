import { describe, expect, it } from "vitest";
import { registerGravityAuthRoutes } from "./gravityAuthRoutes";

type Handler = (req: any, res: any) => Promise<void> | void;

describe("Gravity admin authentication", () => {
  it("accepts the separate admin secret through the admin login endpoint", async () => {
    const routes = new Map<string, Handler>();
    const app = { get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler), post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler), delete: (path: string, handler: Handler) => routes.set(`DELETE ${path}`, handler) } as any;
    registerGravityAuthRoutes(app);
    const username = process.env.GRAVITY_ADMIN_USERNAME;
    const password = process.env.GRAVITY_ADMIN_PASSWORD;
    expect(username).toBeTruthy();
    expect(password).toBeTruthy();
    const response = { headers: {} as Record<string, string>, statusCode: 200, body: undefined as unknown, setHeader(name: string, value: string) { this.headers[name] = value; }, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    await routes.get("POST /api/auth/admin/login")?.({ body: { username, password }, headers: {}, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" }, secure: true, get: () => "vitest" }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ authenticated: true });
    expect(response.headers["Set-Cookie"]).toContain("gravity_admin_session=");
    expect(response.headers["Set-Cookie"]).not.toContain("gravity_session=");
    expect(routes.has("POST /api/auth/admin/logout")).toBe(true);
    expect(routes.has("GET /api/auth/admin/dashboard")).toBe(true);
    expect(routes.has("POST /api/auth/admin/logout")).toBe(true);
    expect(routes.has("DELETE /api/auth/admin/attempts/:id")).toBe(true);
    expect(routes.has("DELETE /api/auth/admin/attempts")).toBe(true);
  });
});
