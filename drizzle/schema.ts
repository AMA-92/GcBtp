import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index } from "drizzle-orm/mysql-core";

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

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  client: varchar("client", { length: 180 }).notNull(),
  site: varchar("site", { length: 240 }).notNull(),
  author: varchar("author", { length: 180 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("XOF").notNull(),
  unitSystem: varchar("unitSystem", { length: 16 }).default("métrique").notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  progress: int("progress").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ownerIdx: index("projects_owner_idx").on(table.ownerId) }));

export const priceItems = mysqlTable("priceItems", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  unit: varchar("unit", { length: 24 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("XOF").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ownerIdx: index("price_items_owner_idx").on(table.ownerId) }));

export const calculations = mysqlTable("calculations", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  projectId: int("projectId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  inputData: text("inputData").notNull(),
  resultData: text("resultData").notNull(),
  formulaVersion: varchar("formulaVersion", { length: 32 }).default("v1.0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ projectIdx: index("calculations_project_idx").on(table.projectId) }));

export const estimates = mysqlTable("estimates", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  projectId: int("projectId").notNull(),
  reference: varchar("reference", { length: 80 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  linesData: text("linesData").notNull(),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ projectIdx: index("estimates_project_idx").on(table.projectId) }));

export const measurements = mysqlTable("measurements", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  projectId: int("projectId").notNull(),
  elementType: varchar("elementType", { length: 64 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  inputsData: text("inputsData").notNull(),
  resultsData: text("resultsData").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ projectIdx: index("measurements_project_idx").on(table.projectId) }));

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  projectId: int("projectId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  shareToken: varchar("shareToken", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ projectIdx: index("reports_project_idx").on(table.projectId) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type PriceItem = typeof priceItems.$inferSelect;
export type Calculation = typeof calculations.$inferSelect;
export type Estimate = typeof estimates.$inferSelect;
export type Measurement = typeof measurements.$inferSelect;
export type Report = typeof reports.$inferSelect;
