export const FRENCH_EUROCODE_DEFAULT_STANDARD = "Eurocode 2 — France" as const;
export const FRENCH_BAEL_LEGACY_STANDARD = "BAEL 91 mod. 99" as const;
/** Référentiel proposé par défaut pour un nouveau projet; les Eurocodes restent sélectionnables. */
export const DEFAULT_PROJECT_STANDARD = FRENCH_BAEL_LEGACY_STANDARD;

/**
 * Profil de calcul français utilisé par défaut dans GcBtp lorsque le maître
 * d'ouvrage n'a pas déclaré une autre base contractuelle. Il ne remplace pas
 * les obligations réglementaires du pays du projet.
 */
export const FRENCH_EUROCODE_PROFILE = {
  id: "france-eurocodes",
  label: "Eurocodes français — NF EN et annexes nationales françaises",
  projectStandard: FRENCH_EUROCODE_DEFAULT_STANDARD,
  nationalAnnex: "France — première génération Eurocodes; vérifier les éditions applicables au marché du projet",
  actionReference: "NF EN 1990:2003 + NF EN 1990/NA:2011; NF EN 1991-1-1:2003 + NF P 06-111-2:2004/A1:2009",
  concreteReference: "NF EN 1992-1-1/NA — édition applicable à confirmer",
  geotechnicalReference: "NF EN 1997-1/NA + NF P 94-261:2013/A1:2017 pour les fondations superficielles; vérifier la compatibilité des éditions",
  seismicReference: "NF EN 1998 et annexe nationale française, si l'analyse sismique est requise",
  sourceReference: "AFNOR — NF EN/NA français; NF P 94-261/A1; éditions et parties applicables à confirmer",
  notice: "Profil français de calcul par défaut GcBtp. Le pays, la ville et le site restent déterminants pour les actions et les données géotechniques. Ce profil ne remplace pas les obligations locales ni la vérification par un ingénieur habilité.",
  sources: {
    eurocodes: "https://normalisation.afnor.org/thematiques/eurocodes/",
    eurocode0NationalAnnex: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-1990-na/eurocodes-structuraux-bases-de-calcul-des-structures-annexe-nationale-a-la-/fa170943/38424",
    eurocode1NationalAnnex: "https://www.boutique.afnor.org/en-gb/standard/nf-p061112-a1/eurocode-1-actions-on-structures-part-11-general-actions-densities-self-wei/fa161515/32867",
    eurocode2NationalAnnex: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-199211-na/eurocode-2-calcul-des-structures-en-beton-partie-11-regles-generales-et-reg/fa185001/46917",
    eurocode7NationalAnnex: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-19971-na/eurocode-7-calcul-geotechnique-partie-1-regles-generales-annexe-nationale-a/fa190693/81354",
    shallowFoundations: "https://www.boutique.afnor.org/fr-fr/norme/nf-p94261-a1/justification-des-ouvrages-geotechniques-normes-dapplication-nationale-de-l/fa186483/58545",
    eurocode7Jrc: "https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-7-geotechnical-design",
  },
} as const;

export function isBaelStandard(standard: string | null | undefined): boolean {
  return /\bbael\b/i.test(standard ?? "");
}

/** All Eurocode project selections use the French NF EN/NA profile by default. */
export function isFrenchEurocodeStandard(standard: string | null | undefined): boolean {
  const value = (standard ?? "").trim().toLocaleLowerCase("fr");
  if (isBaelStandard(value)) return false;
  return !value || /eurocode|\ben\s*199[0-9]|nf\s*en/i.test(value);
}

/** Apply BAEL by default; an explicit Eurocode selection remains available. */
export function normalizeProjectStandard(standard: string | null | undefined): string {
  return isBaelStandard(standard) ? FRENCH_BAEL_LEGACY_STANDARD : isFrenchEurocodeStandard(standard) && Boolean(standard?.trim()) ? FRENCH_EUROCODE_DEFAULT_STANDARD : DEFAULT_PROJECT_STANDARD;
}

export function getFrenchCalculationBasisLabel(standard: string | null | undefined): string {
  return isBaelStandard(standard)
    ? "BAEL 91 mod. 99 — référentiel français historique de béton armé; actions et géotechnique à définir séparément"
    : FRENCH_EUROCODE_PROFILE.label;
}
