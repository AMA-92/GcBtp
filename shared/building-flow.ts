export type BuildingDraft = {
  name: string;
  level: string;
  height: string;
  snap: boolean;
  showNames: boolean;
  loadDirection: boolean;
  continuity: boolean;
  snapRadius: string;
  footerPdf: boolean;
  floorOpacity: string;
  norm: string;
  country: string;
};

export type BuildingFlowState = "list" | "dialog" | "workspace";

export function validateBuildingName(name: string) {
  return name.trim().length > 0;
}

export function serializeBuildingDraft(draft: BuildingDraft) {
  return JSON.stringify(draft);
}

export function restoreBuildingDraft(raw: string | null): BuildingDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<BuildingDraft>;
    if (!value.name || !validateBuildingName(value.name)) return null;
    return {
      name: value.name,
      level: value.level ?? "RDC",
      height: value.height ?? "3.20",
      snap: value.snap ?? true,
      showNames: value.showNames ?? true,
      loadDirection: value.loadDirection ?? true,
      continuity: value.continuity ?? true,
      snapRadius: value.snapRadius ?? "0.80",
      footerPdf: value.footerPdf ?? false,
      floorOpacity: value.floorOpacity ?? "45",
      norm: value.norm ?? "Eurocodes EN 1990/1991/1992",
      country: value.country ?? "Sénégal",
    };
  } catch {
    return null;
  }
}

export function nextBuildingFlowState(current: BuildingFlowState, action: "open" | "cancel" | "create" | "back", name = ""): BuildingFlowState {
  if (current === "list" && action === "open") return "dialog";
  if (current === "dialog" && action === "cancel") return "list";
  if (current === "dialog" && action === "create" && validateBuildingName(name)) return "workspace";
  if (current === "workspace" && action === "back") return "list";
  return current;
}
