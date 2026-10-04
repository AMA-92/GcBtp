import { describe, expect, it } from "vitest";
import { buildLoadSynthesis } from "../shared/load-synthesis";
import type { BuildingLoadRow } from "../shared/building-load-propagation";

const row = (partial: Partial<BuildingLoadRow>): BuildingLoadRow => ({
  id: partial.id ?? "X1",
  label: partial.label ?? "Élément X1",
  type: partial.type ?? "Poteau",
  levelId: partial.levelId ?? "rdc",
  section: partial.section,
  gk: partial.gk ?? 10,
  qk: partial.qk ?? 2,
  nu: partial.nu ?? 16.5,
  nser: partial.nser ?? 12,
  moment: partial.moment,
  sources: partial.sources ?? [],
  supports: partial.supports ?? [],
});

describe("load synthesis", () => {
  it("groups elements by family and similar Nu, with the most loaded first", () => {
    const groups = buildLoadSynthesis([
      row({ id: "P1", nu: 100, type: "Poteau" }),
      row({ id: "P2", nu: 92, type: "Poteau" }),
      row({ id: "P3", nu: 60, type: "Poteau" }),
      row({ id: "S1", nu: 180, type: "Semelle" }),
    ]);

    expect(groups.map(group => group.label)).toEqual(["Poteaux", "Poteaux", "Semelles"]);
    expect(groups[0].rows.map(item => item.id)).toEqual(["P1", "P2"]);
    expect(groups[0].maximumNu).toBe(100);
    expect(groups[1].rows.map(item => item.id)).toEqual(["P3"]);
    expect(groups[2].rows.map(item => item.id)).toEqual(["S1"]);
  });

  it("keeps families ordered even when input rows are mixed", () => {
    const groups = buildLoadSynthesis([
      row({ id: "B1", type: "Poutre", nu: 400 }),
      row({ id: "S1", type: "Semelle", nu: 300 }),
      row({ id: "P1", type: "Poteau", nu: 200 }),
      row({ id: "D1", type: "Dalle", nu: 100 }),
    ]);

    expect(groups.map(group => group.type)).toEqual(["Poteau", "Semelle", "Poutre", "Dalle"]);
  });

  it("retains the complete passport data on each row", () => {
    const [group] = buildLoadSynthesis([
      row({ id: "B1", type: "Poutre", section: "Poutre_20x40", moment: 42.5, sources: ["Dalle PL1 → B1"], supports: ["P1", "P2"] }),
    ]);

    expect(group.rows[0]).toMatchObject({
      section: "Poutre_20x40",
      moment: 42.5,
      sources: ["Dalle PL1 → B1"],
      supports: ["P1", "P2"],
    });
  });
});
