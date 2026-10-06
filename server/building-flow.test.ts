import { describe, expect, it } from "vitest";
import { nextBuildingFlowState, restoreBuildingDraft, serializeBuildingDraft, validateBuildingName, type BuildingDraft } from "../shared/building-flow";

const draft: BuildingDraft = {
  name: "Villa R+2 Cocody",
  level: "Fondations",
  height: "3.40",
  snap: false,
  showNames: true,
  loadDirection: false,
  continuity: true,
  snapRadius: "1.10",
  footerPdf: true,
  floorOpacity: "65",
  norm: "BAEL 91 révisé 99",
  country: "Côte d’Ivoire",
};

describe("parcours bâtiment DSRCAD", () => {
  it("couvre ouverture, nom vide, annulation, création et retour", () => {
    expect(nextBuildingFlowState("list", "open")).toBe("dialog");
    expect(validateBuildingName("   ")).toBe(false);
    expect(nextBuildingFlowState("dialog", "create", "   ")).toBe("dialog");
    expect(nextBuildingFlowState("dialog", "cancel")).toBe("list");
    expect(nextBuildingFlowState("list", "open")).toBe("dialog");
    expect(nextBuildingFlowState("dialog", "create", draft.name)).toBe("workspace");
    expect(nextBuildingFlowState("workspace", "back")).toBe("list");
  });

  it("restaure tous les paramètres du bâtiment après réouverture", () => {
    const restored = restoreBuildingDraft(serializeBuildingDraft(draft));
    expect(restored).toEqual({ ...draft, norm: "BAEL 91 mod. 99" });
    expect(restoreBuildingDraft(null)).toBeNull();
    expect(restoreBuildingDraft("invalid-json")).toBeNull();
  });
});
