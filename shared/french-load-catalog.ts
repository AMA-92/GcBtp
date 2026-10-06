export type FrenchProjectUsage = "habitation" | "logement" | "bureau" | "commerce";
export type FrenchPsiCategory = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "snow-low-altitude" | "snow-high-altitude" | "wind" | "temperature";

/**
 * Catalogue de première génération des annexes nationales françaises,
 * relevé le 06/10/2026. Les valeurs nationales restent versionnées ici,
 * plutôt que recopiées dans les générateurs de combinaisons.
 */
export const FRENCH_EUROCODE_ACTION_CATALOG = {
  id: "fr-nf-en-1990-na-2011-nf-p06-111-2-a1-2009",
  label: "Actions et combinaisons — Eurocodes français, première génération",
  combinationsReference: "NF EN 1990:2003 + NF EN 1990/NA:2011",
  imposedLoadsReference: "NF EN 1991-1-1:2003 + NF P 06-111-2:2004 + NF P 06-111-2/A1:2009",
  equation: "EN 1990, expression 6.10",
  partialFactors: {
    permanentUnfavourable: 1.35,
    permanentFavourable: 1.0,
    variableUnfavourable: 1.5,
    service: 1.0,
    accidentalPermanent: 1.0,
    seismicPermanent: 1.0,
    seismicAction: 1.0,
  },
  psiFactors: {
    A: { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    B: { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    C: { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    D: { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    E: { psi0: 1.0, psi1: 0.9, psi2: 0.8 },
    F: { psi0: 0.7, psi1: 0.7, psi2: 0.6 },
    G: { psi0: 0.7, psi1: 0.5, psi2: 0.3 },
    H: { psi0: 0.0, psi1: 0.0, psi2: 0.0 },
    "snow-low-altitude": { psi0: 0.5, psi1: 0.2, psi2: 0.0 },
    "snow-high-altitude": { psi0: 0.7, psi1: 0.5, psi2: 0.2 },
    wind: { psi0: 0.6, psi1: 0.2, psi2: 0.0 },
    temperature: { psi0: 0.6, psi1: 0.5, psi2: 0.0 },
  },
  sources: {
    eurocode0Annex: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-1990-na/eurocodes-structuraux-bases-de-calcul-des-structures-annexe-nationale-a-la-/fa170943/38424",
    eurocode1Standard: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-199111/eurocode-1-actions-sur-les-structures-partie-11-actions-generales-poids-vol/fa102763/552",
    eurocode1NationalAnnex: "https://www.boutique.afnor.org/en-gb/standard/nf-p061112-a1/eurocode-1-actions-on-structures-part-11-general-actions-densities-self-wei/fa161515/32867",
    eurocode0CombinationTable: "https://www.calculs-eurocodes.com/eurocode_0",
    eurocode1LoadTable: "https://www.icab.fr/doc/icabforce/eurocode/en1991-1-1.htm",
  },
} as const;

export type FrenchPsiFactors = (typeof FRENCH_EUROCODE_ACTION_CATALOG.psiFactors)[FrenchPsiCategory];

/** Valeurs nationales NF du tableau 6.2, complétées des cas usuels de stockage, trafic et toiture. */
export const FRENCH_IMPOSED_LOAD_CATALOG = {
  "A-floor": { category: "A", label: "Catégorie A — planchers d’habitation", qkKnM2: 1.5, QkKn: 2.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "A-stairs": { category: "A", label: "Catégorie A — escaliers", qkKnM2: 2.5, QkKn: 2.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "A-balcony": { category: "A", label: "Catégorie A — balcons", qkKnM2: 3.5, QkKn: 2.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "B-floor": { category: "B", label: "Catégorie B — bureaux", qkKnM2: 2.5, QkKn: 4.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "C1": { category: "C", label: "Catégorie C1 — espaces avec tables", qkKnM2: 2.5, QkKn: 3.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "C2": { category: "C", label: "Catégorie C2 — espaces avec sièges fixes", qkKnM2: 4.0, QkKn: 4.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "C3": { category: "C", label: "Catégorie C3 — espaces sans obstacle à la circulation", qkKnM2: 4.0, QkKn: 4.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "C4": { category: "C", label: "Catégorie C4 — activités physiques", qkKnM2: 5.0, QkKn: 7.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "C5": { category: "C", label: "Catégorie C5 — foules importantes", qkKnM2: 5.0, QkKn: 4.5, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "D1": { category: "D", label: "Catégorie D1 — commerces de détail", qkKnM2: 5.0, QkKn: 5.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  "D2": { category: "D", label: "Catégorie D2 — grands magasins", qkKnM2: 5.0, QkKn: 7.0, source: "Tableau 6.2 (NF) — NF P 06-111-2/A1:2009" },
  E1: { category: "E", label: "Catégorie E1 — stockage", qkKnM2: 7.5, QkKn: 7.0, source: "Tableau 6.4 — NF EN 1991-1-1" },
  F: { category: "F", label: "Catégorie F — véhicules légers", qkKnM2: 2.3, QkKn: 15.0, source: "Tableau 6.8 (NF) — NF P 06-111-2/A1:2009" },
  G: { category: "G", label: "Catégorie G — véhicules de poids moyen", qkKnM2: 5.0, QkKn: 90.0, source: "Tableau 6.8 (NF) — NF P 06-111-2/A1:2009" },
  "H-low-slope": { category: "H", label: "Catégorie H — toiture à pente < 15 % avec étanchéité", qkKnM2: 0.8, QkKn: 1.5, source: "Tableau 6.10 (NF) — NF P 06-111-2/A1:2009" },
  "H-other": { category: "H", label: "Catégorie H — autres toitures", qkKnM2: 0.0, QkKn: 1.5, source: "Tableau 6.10 (NF) — NF P 06-111-2/A1:2009" },
} as const;

export const FRENCH_PROJECT_USAGE_CATALOG = {
  habitation: { id: "habitation", label: "Habitation individuelle", category: "A", psiCategory: "A", load: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].qkKnM2, stairLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-stairs"].qkKnM2, balconyLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-balcony"].qkKnM2, pointLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].QkKn, source: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].source },
  logement: { id: "logement", label: "Logement collectif", category: "A", psiCategory: "A", load: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].qkKnM2, stairLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-stairs"].qkKnM2, balconyLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-balcony"].qkKnM2, pointLoad: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].QkKn, source: FRENCH_IMPOSED_LOAD_CATALOG["A-floor"].source },
  bureau: { id: "bureau", label: "Bureaux", category: "B", psiCategory: "B", load: FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].qkKnM2, stairLoad: FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].qkKnM2, balconyLoad: FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].qkKnM2, pointLoad: FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].QkKn, source: FRENCH_IMPOSED_LOAD_CATALOG["B-floor"].source },
  commerce: { id: "commerce", label: "Commerce de détail (D1)", category: "D1", psiCategory: "D", load: FRENCH_IMPOSED_LOAD_CATALOG.D1.qkKnM2, stairLoad: FRENCH_IMPOSED_LOAD_CATALOG.D1.qkKnM2, balconyLoad: FRENCH_IMPOSED_LOAD_CATALOG.D1.qkKnM2, pointLoad: FRENCH_IMPOSED_LOAD_CATALOG.D1.QkKn, source: FRENCH_IMPOSED_LOAD_CATALOG.D1.source },
} as const satisfies Record<FrenchProjectUsage, { id: FrenchProjectUsage; label: string; category: string; psiCategory: "A" | "B" | "D"; load: number; stairLoad: number; balconyLoad: number; pointLoad: number; source: string }>;

export function getFrenchProjectUsageProfile(usage: string | null | undefined) {
  return FRENCH_PROJECT_USAGE_CATALOG[(usage && usage in FRENCH_PROJECT_USAGE_CATALOG ? usage : "habitation") as FrenchProjectUsage];
}

export function getFrenchPsiFactors(category: FrenchPsiCategory): FrenchPsiFactors {
  return FRENCH_EUROCODE_ACTION_CATALOG.psiFactors[category] as FrenchPsiFactors;
}

export function formatFrenchCoefficient(value: number): string {
  return String(Number(value.toFixed(2))).replace(".", ",");
}
