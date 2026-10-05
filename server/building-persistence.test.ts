import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { createBuildingProjectBundle, hasRevisionConflict, loadBuildingProjectHistory, loadBuildingProjects, parseBuildingProjectBundle, removeBuildingProject, saveBuildingProject, serializeBuildingProjectBundle, type BuildingProjectSnapshot } from "../shared/building-persistence";

type ProjectFixture = { id: string; name: string; levels: Array<{ id: string; elements: unknown[] }> };
const project: ProjectFixture = { id: "project-1", name: "Maison test", levels: [{ id: "rdc", elements: [{ id: "P1", type: "Poteau" }] }] };
const nativeIndexedDB = globalThis.indexedDB;
beforeAll(() => { Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: fakeIndexedDB }); });
afterAll(() => { Object.defineProperty(globalThis, "indexedDB", { configurable: true, writable: true, value: nativeIndexedDB }); });

describe("building project persistence", () => {
  it("round-trips a versioned full-project bundle with workspace settings", () => {
    const bundle = createBuildingProjectBundle(project, { gridDistance: "4.00", loadProgram: { schemaVersion: 1 } }, new Date("2026-10-02T00:00:00.000Z"));
    const parsed = parseBuildingProjectBundle<ProjectFixture, typeof bundle.workspace>(serializeBuildingProjectBundle(bundle));
    expect(parsed.format).toBe("gcbtp-building-project");
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.project).toEqual(project);
    expect(parsed.workspace.gridDistance).toBe("4.00");
  });

  it("rejects malformed and future-version project files clearly", () => {
    expect(() => parseBuildingProjectBundle("not json")).toThrow("JSON invalide");
    expect(() => parseBuildingProjectBundle(JSON.stringify({ format: "gcbtp-building-project", schemaVersion: 9, project, workspace: {} }))).toThrow("Version d’export non prise en charge");
    expect(() => parseBuildingProjectBundle(JSON.stringify({ format: "other", schemaVersion: 1, project, workspace: {} }))).toThrow("n’est pas un export de projet GcBtp");
  });

  it("detects stale cross-tab writes and allows exact-current-revision writes", () => {
    const current: BuildingProjectSnapshot<ProjectFixture> = { projectId: project.id, revision: 3, savedAt: "2026-10-02T00:00:00.000Z", project };
    expect(hasRevisionConflict(current, 2)).toBe(true);
    expect(hasRevisionConflict(current, 3)).toBe(false);
    expect(hasRevisionConflict(null, 0)).toBe(false);
    expect(hasRevisionConflict(null, 1)).toBe(true);
  });

  it("commits IndexedDB snapshots, returns saved revisions, retains history, and rejects stale writes", async () => {
    const id = `indexeddb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const firstProject = { ...project, id };
    const first = await saveBuildingProject(firstProject, 0, new Date("2026-10-02T00:00:00.000Z"), { gridDistance: "4.00" });
    expect(first.status).toBe("saved");
    if (first.status !== "saved") throw new Error("Expected initial IndexedDB save");
    expect(first.snapshot.revision).toBe(1);

    const changedProject = { ...firstProject, name: "Maison test modifiée" };
    const second = await saveBuildingProject(changedProject, 1, new Date("2026-10-02T00:01:00.000Z"), { gridDistance: "5.00" });
    expect(second.status).toBe("saved");
    if (second.status !== "saved") throw new Error("Expected second IndexedDB save");
    expect(second.snapshot.revision).toBe(2);

    const stale = await saveBuildingProject(firstProject, 1);
    expect(stale.status).toBe("conflict");
    if (stale.status !== "conflict") throw new Error("Expected stale revision conflict");
    expect(stale.current?.revision).toBe(2);
    expect((await loadBuildingProjects<ProjectFixture>()).find(item => item.projectId === id)?.project.name).toBe("Maison test modifiée");
    expect((await loadBuildingProjectHistory<ProjectFixture>(id)).map(item => item.revision)).toEqual([2, 1]);
  });

  it("removes a project and all its local revision history", async () => {
    const id = `delete-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const first = await saveBuildingProject({ ...project, id }, 0);
    expect(first.status).toBe("saved");
    const second = await saveBuildingProject({ ...project, id, name: "Version suivante" }, 1);
    expect(second.status).toBe("saved");
    await removeBuildingProject(id);
    expect((await loadBuildingProjects<ProjectFixture>()).some(snapshot => snapshot.projectId === id)).toBe(false);
    expect(await loadBuildingProjectHistory<ProjectFixture>(id)).toEqual([]);
  });
});
