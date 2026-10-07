import { describe, expect, it } from "vitest";
import { DSRCAD_COUNTRIES, DSRCAD_DEFAULT_PLANNING, DSRCAD_MODULES, DSRCAD_NORMS } from "../shared/dsrcad";
import { DEFAULT_PROJECT_STANDARD, FRENCH_EUROCODE_DEFAULT_STANDARD } from "../shared/french-standard-profile";

describe("DSRCAD workspace catalog", () => {
  it("exposes the visible calculation modules", () => {
    expect(DSRCAD_MODULES).toHaveLength(18);
    expect(DSRCAD_MODULES).toContain("Calcul Poutre");
    expect(DSRCAD_MODULES).toContain("Bâtiment");
    expect(DSRCAD_MODULES).toContain("AI Vision");
  });

  it("keeps the technical context choices from the reference flow", () => {
    expect(DSRCAD_NORMS).toEqual([DEFAULT_PROJECT_STANDARD, FRENCH_EUROCODE_DEFAULT_STANDARD]);
    expect(DSRCAD_COUNTRIES).toContain("Sénégal");
  });

  it("provides a usable planning starting point", () => {
    expect(DSRCAD_DEFAULT_PLANNING.title).toBe("Planning Gros Œuvre");
    expect(DSRCAD_DEFAULT_PLANNING.tasks.length).toBeGreaterThanOrEqual(3);
  });
});
