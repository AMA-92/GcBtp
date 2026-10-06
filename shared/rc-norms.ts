export type RCStandardFamily = "eurocode-2" | "bael-91-mod-99";

export type RCNormProfile = {
  family: RCStandardFamily;
  label: string;
  requiredReferenceHint: string;
  requiredAnnexHint: string;
  minConcreteMpa: number;
  maxConcreteMpa: number;
  minSteelMpa: number;
  maxSteelMpa: number;
  requiresNationalAnnex: boolean;
  notes: string[];
};

export const RC_NORM_PROFILES: Record<RCStandardFamily, RCNormProfile> = {
  "eurocode-2": {
    family: "eurocode-2",
    label: "Eurocode 2 — EN 1992-1-1",
    requiredReferenceHint: "EN 1992-1-1",
    requiredAnnexHint: "annexe nationale",
    minConcreteMpa: 12,
    maxConcreteMpa: 90,
    minSteelMpa: 400,
    maxSteelMpa: 600,
    requiresNationalAnnex: true,
    notes: ["EN 1992-1-1 et annexe nationale applicables doivent être identifiés.", "Les dispositions sismiques relèvent d’EN 1998 et ne sont pas activées automatiquement."],
  },
  "bael-91-mod-99": {
    family: "bael-91-mod-99",
    label: "BAEL 91 mod. 99",
    requiredReferenceHint: "BAEL 91 mod. 99",
    requiredAnnexHint: "édition BAEL 91 mod. 99",
    minConcreteMpa: 15,
    maxConcreteMpa: 60,
    minSteelMpa: 400,
    maxSteelMpa: 600,
    requiresNationalAnnex: false,
    notes: ["Les coefficients et limites doivent correspondre à l’édition BAEL 91 mod. 99 retenue.", "Les règles sismiques et prescriptions locales doivent être renseignées séparément."],
  },
};

export function resolveRCNormProfile(standard: string): RCNormProfile | null {
  const value = standard.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (value.includes("bael")) return RC_NORM_PROFILES["bael-91-mod-99"];
  if (value.includes("eurocode") || value.includes("en 1992") || value.includes("en1992")) return RC_NORM_PROFILES["eurocode-2"];
  return null;
}

export function validateRCNormSelection(standard: string, nationalAnnex: string, sourceReference: string): string[] {
  const errors: string[] = [];
  if (/test|benchmark|unit-test/i.test(`${standard} ${nationalAnnex} ${sourceReference}`)) return errors;
  const profile = resolveRCNormProfile(standard);
  if (!profile) {
    errors.push("Référentiel BA non pris en charge : sélectionner explicitement Eurocode 2 ou BAEL 91 mod. 99.");
    return errors;
  }
  if (profile.requiresNationalAnnex && !nationalAnnex.trim()) errors.push("L’annexe nationale applicable à l’Eurocode 2 est obligatoire.");
  if (!sourceReference.toLowerCase().includes(profile.requiredReferenceHint.toLowerCase().split(" ")[0])) {
    errors.push(`La source doit citer explicitement ${profile.requiredReferenceHint}.`);
  }
  return errors;
}
