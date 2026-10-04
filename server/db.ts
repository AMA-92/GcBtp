import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, calculations, estimates, measurements, priceItems, projects, reports, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date(); updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) { values.role = user.role ?? "admin"; updateSet.role = values.role; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProjects(ownerId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt));
}
export async function createProject(data: typeof projects.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(projects).values(data); return r[0].insertId; }
export async function updateProject(id: number, ownerId: number, patch: Partial<typeof projects.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(projects).set(patch).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId))); }
export async function listPrices(ownerId: number) { const db = await getDb(); if (!db) return []; return db.select().from(priceItems).where(eq(priceItems.ownerId, ownerId)).orderBy(priceItems.category, priceItems.label); }
export async function createPrice(data: typeof priceItems.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(priceItems).values(data); return r[0].insertId; }
export async function createCalculation(data: typeof calculations.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(calculations).values(data); return r[0].insertId; }
export async function createMeasurement(data: typeof measurements.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(measurements).values(data); return r[0].insertId; }
export async function listMeasurements(ownerId: number, projectId?: number) { const db = await getDb(); if (!db) return []; const conditions = projectId === undefined ? eq(measurements.ownerId, ownerId) : and(eq(measurements.ownerId, ownerId), eq(measurements.projectId, projectId)); return db.select().from(measurements).where(conditions).orderBy(desc(measurements.createdAt)); }
export async function listCalculations(ownerId: number) { const db = await getDb(); if (!db) return []; return db.select().from(calculations).where(eq(calculations.ownerId, ownerId)).orderBy(desc(calculations.createdAt)); }
export async function createEstimate(data: typeof estimates.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(estimates).values(data); return r[0].insertId; }
export async function listEstimates(ownerId: number) { const db = await getDb(); if (!db) return []; return db.select().from(estimates).where(eq(estimates.ownerId, ownerId)).orderBy(desc(estimates.updatedAt)); }
export async function createReport(data: typeof reports.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const r = await db.insert(reports).values(data); return r[0].insertId; }
export async function listReports(ownerId: number) { const db = await getDb(); if (!db) return []; return db.select().from(reports).where(eq(reports.ownerId, ownerId)).orderBy(desc(reports.createdAt)); }
export async function getReportByToken(shareToken: string) { const db = await getDb(); if (!db) return undefined; const r = await db.select().from(reports).where(eq(reports.shareToken, shareToken)).limit(1); return r[0]; }
