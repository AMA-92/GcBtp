import { describe, expect, it } from "vitest";
import { aggregateTributaryContributions, distributeFloorToBeams } from "../shared/tributary-load";

describe("tributary load distribution", () => {
  it("distributes a rectangular floor to two boundary beams", () => {
    const contributions = distributeFloorToBeams({ id: "PL1", x1: 0, y1: 0, x2: 6, y2: 4, gk: 12, qk: 8, spanDirection: "x" }, [
      { id: "B1", x1: 0, y1: 0, x2: 6, y2: 0 },
      { id: "B2", x1: 0, y1: 4, x2: 6, y2: 4 },
    ]);
    expect(contributions).toHaveLength(2);
    expect(contributions[0].area).toBeCloseTo(12);
    expect(contributions[0].gk).toBeCloseTo(6);
    expect(contributions[0].qk).toBeCloseTo(4);
    expect(contributions[0].source).toContain("PL1");
  });

  it("aggregates contributions from multiple floors by beam", () => {
    const first = distributeFloorToBeams({ id: "PL1", x1: 0, y1: 0, x2: 4, y2: 4, gk: 10, qk: 5, spanDirection: "y" }, [{ id: "B1", x1: 0, y1: 0, x2: 0, y2: 4 }]);
    const second = distributeFloorToBeams({ id: "PL2", x1: 0, y1: 0, x2: 4, y2: 4, gk: 8, qk: 4, spanDirection: "y" }, [{ id: "B1", x1: 0, y1: 0, x2: 0, y2: 4 }]);
    const aggregate = aggregateTributaryContributions([...first, ...second]);
    expect(aggregate.B1.area).toBeCloseTo(32);
    expect(aggregate.B1.gk).toBeCloseTo(18);
    expect(aggregate.B1.qk).toBeCloseTo(9);
    expect(aggregate.B1.sources).toHaveLength(2);
  });
});

  it("propage les charges des poutres vers les poteaux puis les semelles", async () => {
    const { propagateToFoundations } = await import("../shared/tributary-load");
    const contributions = distributeFloorToBeams({ id: "PL3", x1: 0, y1: 0, x2: 6, y2: 4, gk: 12, qk: 8, spanDirection: "x" }, [
      { id: "B3", x1: 0, y1: 0, x2: 6, y2: 0 },
      { id: "B4", x1: 0, y1: 4, x2: 6, y2: 4 },
    ]);
    const result = propagateToFoundations({ contributions, beamToColumns: { B3: ["P1", "P2"], B4: ["P3", "P4"] }, columnToFoundation: { P1: "S1", P2: "S2", P3: "S3", P4: "S4" } });
    expect(result.beams.B3.gk).toBeCloseTo(6);
    expect(result.columns.P1.gk).toBeCloseTo(3);
    expect(result.foundations.S1.gk).toBeCloseTo(3);
    expect(result.warnings).toHaveLength(0);
  });

describe("dalle pleine sans nervures", () => {
  it("répartit la charge sur les quatre appuis du rectangle", () => {
    const contributions = distributeFloorToBeams({
      id: "PL-SOLID",
      x1: 0,
      y1: 0,
      x2: 4,
      y2: 4,
      gk: 40,
      qk: 20,
      spanDirection: "x",
      distributionMode: "two-way",
    }, [
      { id: "B1", x1: 0, y1: 0, x2: 4, y2: 0 },
      { id: "B2", x1: 0, y1: 4, x2: 4, y2: 4 },
      { id: "B3", x1: 0, y1: 0, x2: 0, y2: 4 },
      { id: "B4", x1: 4, y1: 0, x2: 4, y2: 4 },
    ]);
    expect(contributions).toHaveLength(4);
    expect(contributions.every(item => item.source.includes("répartition bidirectionnelle"))).toBe(true);
    expect(contributions.reduce((sum, item) => sum + item.gk, 0)).toBeCloseTo(40);
    expect(contributions.reduce((sum, item) => sum + item.qk, 0)).toBeCloseTo(20);
  });
});
