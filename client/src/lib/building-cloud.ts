import { supabase } from "@/lib/supabase";
import {
  loadBuildingProjects,
  type BuildingProjectLike,
  type BuildingProjectSnapshot,
  type BuildingSaveResult,
} from "@shared/building-persistence";

type CloudBuildingProject = BuildingProjectLike & { country?: string; city?: string };
type BuildingPayload<T extends CloudBuildingProject> = {
  format: "gcbtp-building-project";
  schemaVersion: 1;
  revision: number;
  savedAt: string;
  project: T;
  workspace: unknown;
};
type CloudProjectRow = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  updated_at: string;
  project_data: Record<string, unknown> | null;
};

const PROJECT_DATA_KEY = "gcbtp_building";
const SELECT_COLUMNS = "id, name, country, city, updated_at, project_data";
const accountCacheKey = (accountId: string) => `gcbtp-building-projects-account-v1:${accountId}`;
const LEGACY_OWNER_KEY = "gcbtp-building-legacy-owner-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getBuildingPayload<T extends CloudBuildingProject>(row: CloudProjectRow): BuildingPayload<T> | null {
  const payload = row.project_data?.[PROJECT_DATA_KEY];
  if (!isRecord(payload) || payload.format !== "gcbtp-building-project" || !payload.project || typeof payload.project !== "object") return null;
  const project = payload.project as T;
  if (typeof project.id !== "string" || !Array.isArray(project.levels)) return null;
  return payload as BuildingPayload<T>;
}

function rowToSnapshot<T extends CloudBuildingProject>(row: CloudProjectRow): BuildingProjectSnapshot<T> | null {
  const payload = getBuildingPayload<T>(row);
  if (!payload) return null;
  return {
    projectId: row.id,
    revision: Number(payload.revision) || 1,
    savedAt: typeof payload.savedAt === "string" ? payload.savedAt : row.updated_at,
    project: payload.project,
    workspace: payload.workspace,
  };
}

async function getCloudProjectRow(accountId: string, projectId: string): Promise<CloudProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT_COLUMNS)
    .eq("owner_id", accountId)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudProjectRow | null;
}

function withBuildingPayload<T extends CloudBuildingProject>(
  existing: Record<string, unknown> | null,
  payload: BuildingPayload<T>,
): Record<string, unknown> {
  return { ...(existing ?? {}), [PROJECT_DATA_KEY]: payload };
}

export async function loadCloudBuildingProjects<T extends CloudBuildingProject>(accountId: string): Promise<BuildingProjectSnapshot<T>[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT_COLUMNS)
    .eq("owner_id", accountId)
    .filter("project_data->gcbtp_building->>format", "eq", "gcbtp-building-project")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CloudProjectRow[])
    .map(row => rowToSnapshot<T>(row))
    .filter((snapshot): snapshot is BuildingProjectSnapshot<T> => snapshot !== null);
}

export async function saveCloudBuildingProject<T extends CloudBuildingProject>(
  accountId: string,
  project: T,
  expectedRevision: number,
  now = new Date(),
  workspace?: unknown,
): Promise<BuildingSaveResult<T>> {
  const savedAt = now.toISOString();
  const payload: BuildingPayload<T> = {
    format: "gcbtp-building-project",
    schemaVersion: 1,
    revision: expectedRevision + 1,
    savedAt,
    project,
    workspace: workspace ?? {},
  };

  const existing = await getCloudProjectRow(accountId, project.id);
  const current = existing ? rowToSnapshot<T>(existing) : null;
  if (expectedRevision === 0) {
    if (existing) return { status: "conflict", current };
    const { data, error } = await supabase
      .from("projects")
      .insert({
        id: project.id,
        owner_id: accountId,
        name: project.name,
        country: project.country ?? null,
        city: project.city ?? null,
        project_data: withBuildingPayload(null, payload),
        updated_at: savedAt,
      })
      .select(SELECT_COLUMNS)
      .maybeSingle();
    if (!error && data) {
      const snapshot = rowToSnapshot<T>(data as unknown as CloudProjectRow);
      if (snapshot) return { status: "saved", snapshot };
      throw new Error("La ligne projet a été enregistrée sans données bâtiment lisibles.");
    }
    if (error && error.code !== "23505") throw error;
    const latest = await getCloudProjectRow(accountId, project.id);
    return { status: "conflict", current: latest ? rowToSnapshot<T>(latest) : null };
  }

  if (!existing || !current) return { status: "conflict", current };
  if (current.revision !== expectedRevision) return { status: "conflict", current };
  const previousUpdatedAt = Date.parse(existing.updated_at);
  const nextUpdatedAt = new Date(Math.max(now.getTime(), Number.isFinite(previousUpdatedAt) ? previousUpdatedAt + 1 : now.getTime())).toISOString();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: project.name,
      country: project.country ?? null,
      city: project.city ?? null,
      project_data: withBuildingPayload(existing.project_data, payload),
      updated_at: nextUpdatedAt,
    })
    .eq("id", project.id)
    .eq("owner_id", accountId)
    .eq("updated_at", existing.updated_at)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const snapshot = rowToSnapshot<T>(data as unknown as CloudProjectRow);
    if (snapshot) return { status: "saved", snapshot };
  }
  const latest = await getCloudProjectRow(accountId, project.id);
  return { status: "conflict", current: latest ? rowToSnapshot<T>(latest) : null };
}

export async function deleteCloudBuildingProject(accountId: string, projectId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await getCloudProjectRow(accountId, projectId);
    if (!existing?.project_data || !(PROJECT_DATA_KEY in existing.project_data)) return;
    const nextProjectData = { ...existing.project_data };
    delete nextProjectData[PROJECT_DATA_KEY];
    const previousUpdatedAt = Date.parse(existing.updated_at);
    const updatedAt = new Date(Math.max(Date.now(), Number.isFinite(previousUpdatedAt) ? previousUpdatedAt + 1 : Date.now())).toISOString();
    const { data, error } = await supabase
      .from("projects")
      .update({ project_data: Object.keys(nextProjectData).length ? nextProjectData : null, updated_at: updatedAt })
      .eq("owner_id", accountId)
      .eq("id", projectId)
      .eq("updated_at", existing.updated_at)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data) return;
  }
  throw new Error("Le projet est encore en cours de synchronisation. Fermez la fenêtre puis réessayez.");
}

export function loadAccountBuildingProjectCache<T extends BuildingProjectLike>(accountId: string): BuildingProjectSnapshot<T>[] {
  try {
    const value = JSON.parse(localStorage.getItem(accountCacheKey(accountId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.projectId === "string" && item.project && typeof item.project.id === "string") as BuildingProjectSnapshot<T>[];
  } catch {
    return [];
  }
}

export function saveAccountBuildingProjectCache<T extends BuildingProjectLike>(
  accountId: string,
  snapshot: BuildingProjectSnapshot<T>,
): void {
  const current = loadAccountBuildingProjectCache<T>(accountId);
  const next = [...current.filter(item => item.projectId !== snapshot.projectId), snapshot]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  try {
    localStorage.setItem(accountCacheKey(accountId), JSON.stringify(next));
  } catch {
    // Cloud storage remains authoritative if the device cache is unavailable or full.
  }
}

export function removeAccountBuildingProjectCache(accountId: string, projectId: string): void {
  const next = loadAccountBuildingProjectCache(accountId).filter(item => item.projectId !== projectId);
  try {
    localStorage.setItem(accountCacheKey(accountId), JSON.stringify(next));
  } catch {
    // Cloud storage remains authoritative if the device cache is unavailable or full.
  }
}

/**
 * Old versions stored projects without an account key. Assign that legacy store
 * to the first authenticated account that opens it; later accounts on the same
 * device cannot import or read those unscoped projects.
 */
export async function loadLegacyProjectsForAccount<T extends BuildingProjectLike>(accountId: string): Promise<BuildingProjectSnapshot<T>[]> {
  try {
    const assignedOwner = localStorage.getItem(LEGACY_OWNER_KEY);
    if (assignedOwner && assignedOwner !== accountId) return [];
    if (!assignedOwner) localStorage.setItem(LEGACY_OWNER_KEY, accountId);
    return await loadBuildingProjects<T>();
  } catch {
    return [];
  }
}
