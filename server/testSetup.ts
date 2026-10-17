process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-gravity-auth-only-32chars";
process.env.GRAVITY_AUTH_USERNAME = process.env.GRAVITY_AUTH_USERNAME || "student";
process.env.GRAVITY_AUTH_PASSWORD = process.env.GRAVITY_AUTH_PASSWORD || "student-password";
process.env.GRAVITY_ADMIN_USERNAME = process.env.GRAVITY_ADMIN_USERNAME || "admin";
process.env.GRAVITY_ADMIN_PASSWORD = process.env.GRAVITY_ADMIN_PASSWORD || "admin-password";
