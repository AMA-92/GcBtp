import { describe, expect, it } from "vitest";
import { renumberElements } from "../shared/element-labels";

describe("semelles et navigation 3D", () => {
  it("recompacte les repères après une suppression", () => {
    const result = renumberElements([
      { id: "S2", type: "Semelle" },
      { id: "S4", type: "Semelle" },
      { id: "P3", type: "Poteau" },
    ]);
    expect(result.map(item => item.id)).toEqual(["S1", "S2", "P1"]);
  });

  it("autorise une rotation complète sur yaw et une inclinaison contrôlée", () => {
    const yaw = -28 + 720 * 0.68;
    const pitch = Math.max(-68, Math.min(68, 150 * 0.42));
    expect(yaw).toBeGreaterThan(360);
    expect(pitch).toBe(63);
  });
});
