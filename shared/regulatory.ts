import { getCityClimateProfile, type CityClimateProfile } from "./city-climate";
import { DEFAULT_PROJECT_STANDARD, FRENCH_BAEL_LEGACY_STANDARD, FRENCH_EUROCODE_PROFILE } from "./french-standard-profile";

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
  label: "France — Eurocodes NF EN/NA, édition applicable à confirmer",
  status: "to-confirm",
  note: `Référentiel français de calcul. ${FRENCH_BAEL_LEGACY_STANDARD} est le choix par défaut demandé dans GcBtp, mais AFNOR marque DTU P18-702 et son modificatif A1 annulés; son applicabilité doit être confirmée pour le marché. Pour l’Eurocode 2, confirmer l’édition, l’annexe nationale de même génération et les règles de transition avant utilisation réglementaire.`,
  actions: [FRENCH_EUROCODE_PROFILE.actionReference, "NF EN 1991 — actions selon les annexes nationales françaises", FRENCH_EUROCODE_PROFILE.concreteReference, FRENCH_EUROCODE_PROFILE.geotechnicalReference, FRENCH_EUROCODE_PROFILE.seismicReference],
  concrete: FRENCH_EUROCODE_PROFILE.concreteReference,
  source: FRENCH_EUROCODE_PROFILE.sources.eurocode0NationalAnnex,
  edition: FRENCH_EUROCODE_PROFILE.nationalAnnex,
};

const LOCAL_RULE_TO_CONFIRM: RegulatoryRule = {
  code: "Référentiel national de structure et annexe locale à confirmer",
  label: "Règles locales de calcul à confirmer",
  status: "to-confirm",
  note: "GcBtp ne dispose pas d’une base béton/annexe nationale vérifiée pour ce pays. Le BAEL par défaut de l’application n’est pas une présomption de conformité locale; confirmer les textes du pays, du marché et de l’autorité compétente.",
  actions: ["Actions et combinaisons nationales à identifier"],
  concrete: "Règles nationales de béton armé à identifier",
};

const AFRICAN_FRENCH_BASIS_RULE: RegulatoryRule = {
  ...FRENCH_DEFAULT_RULE,
  label: "Référentiel français retenu comme base de calcul du projet",
  note: `Par choix du projet, GcBtp utilise le référentiel français (${FRENCH_BAEL_LEGACY_STANDARD} par défaut; Eurocode 2 sélectionnable) pour ce site africain. Cela ne signifie pas que ces textes sont les normes nationales du pays. Confirmer la base contractuelle, la version du référentiel et les paramètres propres au site; les actions climatiques, le sol, le séisme et la géotechnique restent à renseigner.`,
};

/** Les pays africains utilisent la base française du produit, pas un code national africain inféré. */
export const REGULATORY_RULES: Record<string, RegulatoryRule> = {
  France: FRENCH_DEFAULT_RULE,
  ...Object.fromEntries(AFRICAN_COUNTRIES.map(country => [country, AFRICAN_FRENCH_BASIS_RULE])),
};

export type RegulatorySiteProfile = {
  country: string;
  city?: string;
  rule: RegulatoryRule;
  preferredNorm: string | null;
  constructionContext: string;
  climate: CityClimateProfile;
  wind: { zone?: string; basicSpeed?: number; pressure?: number; status: "input" | "provisional" | "to-confirm" };
  seismic: { zone?: string; coefficient?: number; soilClass?: string; status: "input" | "provisional" | "to-confirm" };
  snow: { zone?: string; groundLoad?: number; status: "input" | "provisional" | "to-confirm" | "not-applicable" };
  provenance: { source: string; checkedAt?: string; authority?: string };
  warnings: string[];
};

export function getRegulatoryRule(country: string): RegulatoryRule {
  const normalizedCountry = country.trim().toLocaleLowerCase("fr");
  if (normalizedCountry === "france") return FRENCH_DEFAULT_RULE;
  if (AFRICAN_COUNTRIES.some(item => item.toLocaleLowerCase("fr") === normalizedCountry)) return AFRICAN_FRENCH_BASIS_RULE;
  return { ...LOCAL_RULE_TO_CONFIRM, label: `${country || "Pays non renseigné"} — règles locales à confirmer` };
}

export function getRegulatorySiteProfile(country: string, city = ""): RegulatorySiteProfile {
  const isFrance = country.trim().toLocaleLowerCase("fr") === "france";
  const isAfrican = AFRICAN_COUNTRIES.some(item => item.toLocaleLowerCase("fr") === country.trim().toLocaleLowerCase("fr"));
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
    wind: { zone: isFrance ? "À confirmer selon NF EN 1991-1-4/NA et l’exposition du site" : isAfrican ? "Référentiel français sélectionné; pression et exposition locales à saisir/justifier" : "À confirmer selon le référentiel national applicable et l’exposition du site", status: "to-confirm" as const },
    source: "Catalogue climatique GcBtp — à compléter",
    note: "Renseigner une ville du catalogue ou confirmer les données auprès d’une source locale.",
  };
  const warnings = [
    ...(isFrance
      ? [`Le BAEL par défaut est un choix legacy demandé; vérifier son applicabilité au marché. Pour l’Eurocode 2, confirmer la génération EN et son annexe nationale française de même génération.`]
      : isAfrican
        ? [`Le référentiel français est utilisé par choix du projet; GcBtp ne le présente pas comme le code national de ${country}. Le BAEL est le défaut logiciel et l’Eurocode 2 reste sélectionnable.`]
        : [`Aucune base nationale vérifiée pour ${country}; choisir et confirmer le référentiel contractuel avant le calcul.`]),
    `Les actions de vent, neige, séisme et sol doivent être justifiées selon le référentiel français sélectionné et les données locales du site (${country}); aucune zone climatique n’est déduite du seul pays.`,
    "Les valeurs préliminaires ne doivent pas être utilisées seules pour un permis, une exécution ou une signature.",
  ];
  const constructionContext = country === "Gambie" ? "Béton armé courant, maçonnerie de remplissage, climat tropical côtier ; charges de pluie et vent à confirmer par site." : country === "Mauritanie" ? "Béton armé et maçonnerie courante, climat saharien/aride ; thermique, vent, sable et sol à confirmer par site." : country === "Mali" ? "Béton armé et maçonnerie courante, climat soudano-sahélien ; thermique, vent et sol à confirmer par site." : "Béton armé et maçonnerie courante ; exposition climatique, corrosion et sol à confirmer par site.";
  return {
    country,
    city: cityLabel || undefined,
    rule,
    preferredNorm: isFrance || isAfrican ? DEFAULT_PROJECT_STANDARD : null,
    constructionContext,
    climate,
    wind: climate.wind,
    seismic: climate.seismic,
    snow: climate.snow,
    provenance: { source: rule.source ?? (isFrance || isAfrican ? FRENCH_EUROCODE_PROFILE.sources.eurocodes : `Référentiel national de ${country} non vérifié`), authority: "Confirmer la base de calcul française retenue, ses éditions et les données de site auprès du responsable du projet" },
    warnings,
  };
}
