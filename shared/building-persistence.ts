export const BUILDING_BUNDLE_FORMAT = "gcbtp-building-project";
export const BUILDING_BUNDLE_SCHEMA_VERSION = 1;
const DB_NAME = "gcbtp-building-workspace";
const DB_VERSION = 1;
const CURRENT_STORE = "currentProjects";
const HISTORY_STORE = "projectHistory";
const LOCAL_KEY = "gcbtp-building-projects-v2";
const SESSION_KEY = "gcbtp-building-projects";
const HISTORY_LIMIT = 20;

export type BuildingProjectLike = { id: string; name: string; levels: unknown[] };
export type BuildingProjectSnapshot<T extends BuildingProjectLike> = {
  projectId: string;
  revision: number;
  savedAt: string;
  project: T;
  workspace?: unknown;
};
export type BuildingSaveResult<T extends BuildingProjectLike> =
  | { status: "saved"; snapshot: BuildingProjectSnapshot<T> }
  | { status: "conflict"; current: BuildingProjectSnapshot<T> | null };
export type BuildingProjectBundle<T extends BuildingProjectLike, W = Record<string, unknown>> = {
  format: typeof BUILDING_BUNDLE_FORMAT;
  schemaVersion: typeof BUILDING_BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  project: T;
  workspace: W;
};

type HistoryRecord<T extends BuildingProjectLike> = BuildingProjectSnapshot<T> & { snapshotId: string };
type LocalContainer<T extends BuildingProjectLike> = {
  schemaVersion: 1;
  current: BuildingProjectSnapshot<T>[];
  history: HistoryRecord<T>[];
};

function getIndexedDB(): IDBFactory | null {
  try { return typeof indexedDB === "undefined" ? null : indexedDB; } catch { return null; }
}

function openDatabase(): Promise<IDBDatabase> {
  const factory = getIndexedDB();
  if (!factory) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CURRENT_STORE)) database.createObjectStore(CURRENT_STORE, { keyPath: "projectId" });
      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        const history = database.createObjectStore(HISTORY_STORE, { keyPath: "snapshotId" });
        history.createIndex("projectId", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function parseLocalContainer<T extends BuildingProjectLike>(value: string | null): LocalContainer<T> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as LocalContainer<T> | T[];
    if (Array.isArray(parsed)) {
      const current = parsed.filter(isProjectLike).map(project => ({ projectId: project.id, revision: 0, savedAt: new Date(0).toISOString(), project: project as T }));
      return { schemaVersion: 1, current, history: [] };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as LocalContainer<T>).current)) {
      const container = parsed as LocalContainer<T>;
      return { schemaVersion: 1, current: container.current.filter(item => isProjectLike(item?.project)), history: Array.isArray(container.history) ? container.history.filter(item => isProjectLike(item?.project)) : [] };
    }
  } catch { return null; }
  return null;
}

function isProjectLike(value: unknown): value is BuildingProjectLike {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return typeof project.id === "string" && typeof project.name === "string" && Array.isArray(project.levels);
}

function readFallback<T extends BuildingProjectLike>(): LocalContainer<T> {
  try {
    const local = parseLocalContainer<T>(localStorage.getItem(LOCAL_KEY));
    if (local) return local;
  } catch { /* localStorage may be denied or full */ }
  try {
    const session = parseLocalContainer<T>(sessionStorage.getItem(SESSION_KEY));
    if (session) return session;
  } catch { /* sessionStorage may be denied */ }
  return { schemaVersion: 1, current: [], history: [] };
}

function writeFallback<T extends BuildingProjectLike>(container: LocalContainer<T>): void {
  const limited = { ...container, history: container.history.slice(-HISTORY_LIMIT) };
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(limited)); } catch { /* Continue with the smaller session backup. */ }
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(limited.current.map(item => item.project))); } catch { /* In-memory editing remains available. */ }
}

export function hasRevisionConflict<T extends BuildingProjectLike>(current: BuildingProjectSnapshot<T> | null, expectedRevision: number): boolean {
  return (current?.revision ?? 0) !== expectedRevision;
}

export async function loadBuildingProjects<T extends BuildingProjectLike>(): Promise<BuildingProjectSnapshot<T>[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(CURRENT_STORE, "readonly");
    const rows = await requestResult(transaction.objectStore(CURRENT_STORE).getAll() as IDBRequest<BuildingProjectSnapshot<T>[]>);
    if (rows.length) return rows;
  } catch { /* Use localStorage/sessionStorage for older WebViews, private mode, or blocked IDB. */ }
  return readFallback<T>().current;
}

export async function saveBuildingProject<T extends BuildingProjectLike>(project: T, expectedRevision: number, now = new Date(), workspace?: unknown): Promise<BuildingSaveResult<T>> {
  const database = await openDatabase().catch(() => null);
  if (!database) return saveBuildingProjectFallback(project, expectedRevision, now, workspace);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CURRENT_STORE, HISTORY_STORE], "readwrite");
    const currentStore = transaction.objectStore(CURRENT_STORE);
    const historyStore = transaction.objectStore(HISTORY_STORE);
    const request = currentStore.get(project.id);
    let result: BuildingSaveResult<T> | null = null;
    request.onsuccess = () => {
      const current = (request.result as BuildingProjectSnapshot<T> | undefined) ?? null;
      if (hasRevisionConflict(current, expectedRevision)) {
        result = { status: "conflict", current };
        transaction.abort();
        return;
      }
      const revision = (current?.revision ?? 0) + 1;
      const snapshot: BuildingProjectSnapshot<T> = { projectId: project.id, revision, savedAt: now.toISOString(), project, workspace };
      const history: HistoryRecord<T> = { ...snapshot, snapshotId: `${project.id}:${revision}` };
      result = { status: "saved", snapshot };
      currentStore.put(snapshot);
      historyStore.put(history);
      const allForProject = historyStore.index("projectId").getAll(project.id);
      allForProject.onsuccess = () => {
        const rows = (allForProject.result as HistoryRecord<T>[]).sort((a, b) => a.revision - b.revision);
        rows.slice(0, Math.max(0, rows.length - HISTORY_LIMIT)).forEach(old => historyStore.delete(old.snapshotId));
      };
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => result ? resolve(result) : reject(new Error("Project save completed without a version result"));
    transaction.onabort = () => result ? resolve(result) : reject(transaction.error ?? new Error("Project save interrupted"));
    transaction.onerror = () => { /* onabort reports the transaction outcome */ };
  });
}

function saveBuildingProjectFallback<T extends BuildingProjectLike>(project: T, expectedRevision: number, now: Date, workspace?: unknown): BuildingSaveResult<T> {
  const container = readFallback<T>();
  const current = container.current.find(item => item.projectId === project.id) ?? null;
  if (hasRevisionConflict(current, expectedRevision)) return { status: "conflict", current };
  const snapshot: BuildingProjectSnapshot<T> = { projectId: project.id, revision: (current?.revision ?? 0) + 1, savedAt: now.toISOString(), project, workspace };
  container.current = [...container.current.filter(item => item.projectId !== project.id), snapshot];
  container.history = [...container.history, { ...snapshot, snapshotId: `${project.id}:${snapshot.revision}` }].slice(-HISTORY_LIMIT);
  writeFallback(container);
  return { status: "saved", snapshot };
}

export async function loadBuildingProjectHistory<T extends BuildingProjectLike>(projectId: string): Promise<BuildingProjectSnapshot<T>[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(HISTORY_STORE, "readonly");
    const request = transaction.objectStore(HISTORY_STORE).index("projectId").getAll(projectId) as IDBRequest<HistoryRecord<T>[]>;
    const rows = await requestResult(request);
    return rows.sort((a, b) => b.revision - a.revision);
  } catch {
    return readFallback<T>().history.filter(item => item.projectId === projectId).sort((a, b) => b.revision - a.revision);
  }
}

export async function removeBuildingProject(projectId: string): Promise<void> {
  const removeFromFallback = () => {
    const container = readFallback<BuildingProjectLike>();
    container.current = container.current.filter(snapshot => snapshot.projectId !== projectId);
    container.history = container.history.filter(snapshot => snapshot.projectId !== projectId);
    writeFallback(container);
  };
  if (!getIndexedDB()) {
    removeFromFallback();
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([CURRENT_STORE, HISTORY_STORE], "readwrite");
    transaction.objectStore(CURRENT_STORE).delete(projectId);
    const historyRows = transaction.objectStore(HISTORY_STORE).index("projectId").openCursor(projectId);
    historyRows.onsuccess = () => {
      const cursor = historyRows.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Project removal failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Project removal aborted"));
  });
  removeFromFallback();
}

export function createBuildingProjectBundle<T extends BuildingProjectLike, W>(project: T, workspace: W, exportedAt = new Date()): BuildingProjectBundle<T, W> {
  return { format: BUILDING_BUNDLE_FORMAT, schemaVersion: BUILDING_BUNDLE_SCHEMA_VERSION, exportedAt: exportedAt.toISOString(), project, workspace };
}

export function serializeBuildingProjectBundle<T extends BuildingProjectLike, W>(bundle: BuildingProjectBundle<T, W>): string {
  return JSON.stringify(bundle, null, 2);
}

export function parseBuildingProjectBundle<T extends BuildingProjectLike = BuildingProjectLike, W = Record<string, unknown>>(raw: string): BuildingProjectBundle<T, W> {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Fichier JSON invalide."); }
  if (!value || typeof value !== "object") throw new Error("Fichier de projet invalide.");
  const bundle = value as Partial<BuildingProjectBundle<T, W>>;
  if (bundle.format !== BUILDING_BUNDLE_FORMAT) throw new Error("Ce fichier n’est pas un export de projet GcBtp.");
  if (bundle.schemaVersion !== BUILDING_BUNDLE_SCHEMA_VERSION) throw new Error(`Version d’export non prise en charge : ${String(bundle.schemaVersion)}.`);
  if (!isProjectLike(bundle.project)) throw new Error("Le projet exporté ne contient pas d’identifiant, de nom ou de niveaux valides.");
  if (!bundle.workspace || typeof bundle.workspace !== "object" || Array.isArray(bundle.workspace)) throw new Error("Les paramètres de l’espace de travail sont absents ou invalides.");
  return bundle as BuildingProjectBundle<T, W>;
}
