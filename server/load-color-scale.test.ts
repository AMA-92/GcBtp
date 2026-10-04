import { describe, expect, it } from "vitest";
import { createLoadScale } from "@shared/load-color-scale";

describe("load color scale", () => {
  it("maps the minimum to a pale color and the maximum to vivid red", () => {
    const scale = createLoadScale([
      { id: "P1", levelId: "rdc", type: "Poteau", nu: 100 },
      { id: "P2", levelId: "rdc", type: "Poteau", nu: 200 },
      { id: "S1", levelId: "foundation", type: "Semelle", nu: 150 },
    ]);
    expect(scale.minimum).toBe(100);
    expect(scale.maximum).toBe(200);
    expect(scale.colorFor({ id: "P1", levelId: "rdc", type: "Poteau", nu: 100 })).toBe("#ffe cb4".replace(" ", ""));
    expect(scale.colorFor({ id: "P2", levelId: "rdc", type: "Poteau", nu: 200 })).toBe("#ff1717");
  });

  it("clamps values outside the analyzed range", () => {
    const scale = createLoadScale([
      { id: "P1", levelId: "rdc", type: "Poteau", nu: 100 },
      { id: "P2", levelId: "rdc", type: "Poteau", nu: 200 },
    ]);
    expect(scale.colorFor({ id: "x", levelId: "rdc", type: "Poteau", nu: 50 })).toBe("#ffecb4");
    expect(scale.colorFor({ id: "x", levelId: "rdc", type: "Poteau", nu: 250 })).toBe("#ff1717");
  });
});
