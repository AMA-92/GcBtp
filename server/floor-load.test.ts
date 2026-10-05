import { describe, expect, it } from "vitest";
import { summarizeFloorLoads } from "../shared/floor-load";
import { defaultBalconyFloorConfig } from "../shared/floor-config";

describe("floor load summaries on metric grid positions", () => {
  it("uses the physical area for a fractional balcony on a non-uniform grid", () => {
    const summary = summarizeFloorLoads([
      {
        type: "Balcon",
        section: "Balcon BA 20 cm",
        x: 0.5,
        y: 1,
        x2: 1,
        y2: 1.8,
        floorConfig: defaultBalconyFloorConfig(),
      },
    ], "4", defaultBalconyFloorConfig(), {
      xAxisPositionsM: [0, 4, 8],
      yAxisPositionsM: [0, 4, 9],
    });

    expect(summary.surface).toBeCloseTo(8);
    expect(summary.permanent).toBeCloseTo(48);
    expect(summary.live).toBeCloseTo(28);
  });
});
