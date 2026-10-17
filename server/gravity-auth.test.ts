import { describe, expect, it } from "vitest";
import { registerGravityAuthRoutes } from "./gravityAuthRoutes";

type Handler = (req: any, res: any) => Promise<void> | void;

describe("Gravity server authentication", () => {
  it("creates a pending approval request for valid library credentials", async () => {
    const routes = new Map<string, Handler>();
    const app = {
      get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler),
      delete: (path: string, handler: Handler) => routes.set(`DELETE ${path}`, handler),
    } as any;
    registerGravityAuthRoutes(app);

    const password = process.env.GRAVITY_AUTH_PASSWORD;
    expect(password).toBeTruthy();

    const response = {
      headers: {} as Record<string, string>,
      statusCode: 200,
      body: undefined as unknown,
      setHeader(name: string, value: string) { this.headers[name] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };

    await routes.get("POST /api/auth/login")?.(
      {
        body: { displayName: "أحمد محمد", password, remember: true },
        headers: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
        secure: true,
        get: () => "vitest",
      },
      response,
    );

    expect(response.statusCode).toBe(202);
    expect(response.body).toMatchObject({ pending: true });
    expect(response.body).toHaveProperty("requestId");
  });
});
