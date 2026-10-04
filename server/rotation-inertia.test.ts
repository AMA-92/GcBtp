import { describe, expect, it } from "vitest";
import { decayRotationVelocity, hasVisibleInertia } from "../shared/rotation-inertia";

describe("rotation inertielle 3D", () => {
  it("décélère progressivement sans inverser le mouvement", () => {
    const next = decayRotationVelocity({ yaw: 10, pitch: -5 });
    expect(next).toEqual({ yaw: 9.3, pitch: -4.65 });
    expect(Math.abs(next.yaw)).toBeLessThan(10);
    expect(Math.sign(next.pitch)).toBe(-1);
  });

  it("s’arrête sous le seuil de mouvement visible", () => {
    expect(hasVisibleInertia({ yaw: 0.02, pitch: -0.01 })).toBe(false);
    expect(hasVisibleInertia({ yaw: 0.04, pitch: 0 })).toBe(true);
  });
});
