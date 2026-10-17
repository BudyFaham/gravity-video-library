import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  username: varchar("username", { length: 128 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 128 }).notNull(),
  successful: int("successful").notNull().default(0),
  reason: varchar("reason", { length: 64 }).notNull(),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const loginRequests = mysqlTable("login_requests", {
  id: varchar("id", { length: 96 }).primaryKey(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  username: varchar("username", { length: 128 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 128 }).notNull(),
  userAgent: text("userAgent"),
  remember: int("remember").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  denialMessage: text("denialMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const gravitySessions = mysqlTable("gravity_sessions", {
  id: varchar("id", { length: 96 }).primaryKey(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  username: varchar("username", { length: 128 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 128 }).notNull(),
  userAgent: text("userAgent"),
  remember: int("remember").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  endReason: varchar("endReason", { length: 24 }),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const customVideos = mysqlTable("custom_videos", {
  id: varchar("id", { length: 32 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  lesson: varchar("lesson", { length: 255 }).notNull(),
  section: varchar("section", { length: 32 }).notNull(),
  solutionGroup: varchar("solutionGroup", { length: 64 }),
  duration: varchar("duration", { length: 32 }),
  homework: text("homework"),
  description: text("description"),
  sortOrder: int("sortOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;
export type LoginRequest = typeof loginRequests.$inferSelect;
export type GravitySession = typeof gravitySessions.$inferSelect;
export type InsertGravitySession = typeof gravitySessions.$inferInsert;
export type CustomVideo = typeof customVideos.$inferSelect;
export type InsertCustomVideo = typeof customVideos.$inferInsert;
