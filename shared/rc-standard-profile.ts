export type RCStandardFamily = "eurocode-2" | "bael-91-99" | "unsupported";

export type RCStandardProfile = {
  family: RCStandardFamily;
  supportedForPreDesign: boolean;
  suggestedAlphaCC: number | null;
  note: string;
};

export function resolveRCStandardProfile(standard: string): RCStandardProfile {
  const normalized = standard.trim().toLocaleLowerCase("fr").replace(/[–—]/g, "-");
  if (/\bbael\b/.test(normalized)) {
    return {
      family: "bael-91-99",
      supportedForPreDesign: true,
      suggestedAlphaCC: 1,
      note: "Profil BAEL déclaré; les vérifications de ce moteur restent des pré-études génériques, non certifiées BAEL.",
    };
  }
  if (/eurocode|en\s*1992|en1992/.test(normalized)) {
    return {
      family: "eurocode-2",
      supportedForPreDesign: true,
      suggestedAlphaCC: 0.85,
      note: "Profil Eurocode 2 déclaré; édition et annexe nationale à confirmer, et les vérifications restent non certifiées.",
    };
  }
  return {
    family: "unsupported",
    supportedForPreDesign: false,
    suggestedAlphaCC: null,
    note: `Le référentiel « ${standard || "non renseigné"} » est sélectionné dans le projet, mais le moteur BA de pré-étude ne le prend pas en charge. Aucun ferraillage ne sera généré.`,
  };
}

export function sameRCStandardFamily(left: string, right: string): boolean {
  const leftProfile = resolveRCStandardProfile(left);
  const rightProfile = resolveRCStandardProfile(right);
  if (leftProfile.family !== rightProfile.family) return false;
  if (leftProfile.family !== "unsupported") return true;
  return left.trim().toLocaleLowerCase("fr") === right.trim().toLocaleLowerCase("fr");
}
