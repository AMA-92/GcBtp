import { describe, expect, it } from "vitest";
import { validateStructuralModel } from "../shared/structural-validation";

describe("validateStructuralModel", () => {
  it("détecte une continuité poteau–semelle correcte", () => {
    const result = validateStructuralModel([
      { id: "foundation", label: "Fondation", elevation: "0", elements: [{ id: "P1", type: "Poteau", x: 0, y: 0 }, { id: "S1", type: "Semelle", x: 0, y: 0 }] },
      { id: "rdc", label: "RDC", elevation: "3.2", elements: [{ id: "P2", type: "Poteau", x: 0, y: 0 }] },
    ]);
    expect(result.status).toBe("a_verifier");
    expect(result.issues).toHaveLength(0);
  });

  it("signale une discontinuité verticale", () => {
    const result = validateStructuralModel([
      { id: "foundation", label: "Fondation", elevation: "0", elements: [{ id: "S1", type: "Semelle", x: 0, y: 0 }] },
      { id: "rdc", label: "RDC", elevation: "3.2", elements: [{ id: "P2", type: "Poteau", x: 4, y: 4 }] },
    ]);
    expect(result.status).toBe("non_conforme");
    expect(result.issues.some(issue => issue.code === "vertical-offset")).toBe(true);
  });
});
