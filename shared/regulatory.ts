import { getCityClimateProfile, type CityClimateProfile } from "./city-climate";
import { FRENCH_EUROCODE_DEFAULT_STANDARD, FRENCH_EUROCODE_PROFILE } from "./french-standard-profile";

export type RegulatoryRule = {
  code: string;
  label: string;
  status: "national" | "adopted" | "adapted" | "to-confirm";
  note: string;
  actions: string[];
  concrete: string;
  source?: string;
  edition?: string;
};

export const AFRICAN_COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso", "Burundi", "Cameroun", "Cap-Vert", "Comores", "Congo", "Côte d’Ivoire", "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon", "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Kenya", "Lesotho", "Liberia", "Libye", "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie", "Niger", "Nigeria", "Ouganda", "République centrafricaine", "République démocratique du Congo", "Rwanda", "São Tomé-et-Príncipe", "Sénégal", "Seychelles", "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Tanzanie", "Tchad", "Togo", "Tunisie", "Zambie", "Zimbabwe",
] as const;

const FRENCH_DEFAULT_RULE: RegulatoryRule = {
  code: `${FRENCH_EUROCODE_PROFILE.actionReference} · ${FRENCH_EUROCODE_PROFILE.concreteReference} · ${FRENCH_EUROCODE_PROFILE.geotechnicalReference}`,
  label: "Eurocodes français — NF EN et annexes nationales françaises",
  status: "adapted",
  note: "GcBtp applique le référentiel français de calcul par défaut, quel que soit le pays du projet. Les paramètres d’actions, de sol et de site restent propres au lieu. Ce choix technique ne remplace ni les obligations administratives locales ni la vérification par un ingénieur habilité.",
  actions: [FRENCH_EUROCODE_PROFILE.actionReference, "NF EN 1991 — actions selon les annexes nationales françaises", FRENCH_EUROCODE_PROFILE.concreteReference, FRENCH_EUROCODE_PROFILE.geotechnicalReference, FRENCH_EUROCODE_PROFILE.seismicReference],
  concrete: FRENCH_EUROCODE_PROFILE.concreteReference,
  source: FRENCH_EUROCODE_PROFILE.sources.eurocode0NationalAnnex,
  edition: FRENCH_EUROCODE_PROFILE.nationalAnnex,
};

/** Toutes les fiches de pays pointent vers la même base française; seul le contexte de site varie. */
export const REGULATORY_RULES: Record<string, RegulatoryRule> = Object.fromEntries(
  AFRICAN_COUNTRIES.map(country => [country, FRENCH_DEFAULT_RULE]),
);

export type RegulatorySiteProfile = {
  country: string;
  city?: string;
  rule: RegulatoryRule;
  preferredNorm: typeof FRENCH_EUROCODE_DEFAULT_STANDARD;
  constructionContext: string;
  climate: CityClimateProfile;
  wind: { zone?: string; basicSpeed?: number; pressure?: number; status: "input" | "provisional" | "to-confirm" };
  seismic: { zone?: string; coefficient?: number; soilClass?: string; status: "input" | "provisional" | "to-confirm" };
  snow: { zone?: string; groundLoad?: number; status: "input" | "provisional" | "to-confirm" | "not-applicable" };
  provenance: { source: string; checkedAt?: string; authority?: string };
  warnings: string[];
};

export function getRegulatoryRule(_country: string): RegulatoryRule {
  return FRENCH_DEFAULT_RULE;
}

export function getRegulatorySiteProfile(country: string, city = ""): RegulatorySiteProfile {
  const rule = getRegulatoryRule(country);
  const cityLabel = city.trim();
  const climate = getCityClimateProfile(country, cityLabel) ?? {
    country,
    city: cityLabel || "Ville non renseignée",
    climateZone: "à déterminer",
    windExposure: "à déterminer",
    rainfallExposure: "à déterminer",
    snow: { groundLoad: 0, status: "to-confirm" as const },
    seismic: { zone: "À confirmer selon carte nationale et étude de sol", status: "to-confirm" as const },
    wind: { zone: "À confirmer selon NF EN 1991-1-4/NA et l’exposition du site", status: "to-confirm" as const },
    source: "Catalogue climatique GcBtp — à compléter",
    note: "Renseigner une ville du catalogue ou confirmer les données auprès d’une source locale.",
  };
  const warnings = [
    "La base de calcul par défaut est française; les obligations administratives du pays du projet doivent être vérifiées séparément.",
    "Les actions de vent, neige, séisme et sol doivent être renseignées ou confirmées à partir des données du site et des annexes françaises applicables.",
    "Les valeurs préliminaires ne doivent pas être utilisées seules pour un permis, une exécution ou une signature.",
  ];
  const constructionContext = country === "Gambie" ? "Béton armé courant, maçonnerie de remplissage, climat tropical côtier ; charges de pluie et vent à confirmer par site." : country === "Mauritanie" ? "Béton armé et maçonnerie courante, climat saharien/aride ; thermique, vent, sable et sol à confirmer par site." : country === "Mali" ? "Béton armé et maçonnerie courante, climat soudano-sahélien ; thermique, vent et sol à confirmer par site." : "Béton armé et maçonnerie courante ; exposition climatique, corrosion et sol à confirmer par site.";
  return {
    country,
    city: cityLabel || undefined,
    rule,
    preferredNorm: FRENCH_EUROCODE_DEFAULT_STANDARD,
    constructionContext,
    climate,
    wind: climate.wind,
    seismic: climate.seismic,
    snow: climate.snow,
    provenance: { source: rule.source ?? FRENCH_EUROCODE_PROFILE.sources.eurocodes, authority: "Données de site à confirmer par l’autorité compétente ou le bureau de contrôle" },
    warnings,
  };
}
