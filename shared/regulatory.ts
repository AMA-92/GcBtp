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

import { getCityClimateProfile, type CityClimateProfile } from "./city-climate";

export type RegulatorySiteProfile = {
  country: string;
  city?: string;
  rule: RegulatoryRule;
  preferredNorm: "BAEL 91 mod. 99" | "Eurocode 2" | "BS 8110";
  constructionContext: string;
  climate: CityClimateProfile;
  wind: { zone?: string; basicSpeed?: number; pressure?: number; status: "input" | "provisional" | "to-confirm" };
  seismic: { zone?: string; coefficient?: number; soilClass?: string; status: "input" | "provisional" | "to-confirm" };
  snow: { zone?: string; groundLoad?: number; status: "input" | "provisional" | "to-confirm" | "not-applicable" };
  provenance: { source: string; checkedAt?: string; authority?: string };
  warnings: string[];
};

export const AFRICAN_COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso", "Burundi", "Cameroun", "Cap-Vert", "Comores", "Congo", "Côte d’Ivoire", "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon", "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Kenya", "Lesotho", "Liberia", "Libye", "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie", "Niger", "Nigeria", "Ouganda", "République centrafricaine", "République démocratique du Congo", "Rwanda", "São Tomé-et-Príncipe", "Sénégal", "Seychelles", "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Tanzanie", "Tchad", "Togo", "Tunisie", "Zambie", "Zimbabwe",
] as const;

const EURO = { code: "EN 1990 + EN 1991 + EN 1992", label: "Eurocodes structuraux", status: "adopted", note: "Référentiel proposé lorsque l’autorité locale l’a adopté ou lorsqu’aucun code national confirmé n’est renseigné.", actions: ["EN 1990 — bases de calcul", "EN 1991 — actions", "EN 1992 — béton armé", "EN 1997 — géotechnique"], concrete: "EN 206 / spécification locale", source: "https://publications.jrc.ec.europa.eu/repository/bitstream/JRC115175/jrc115157_online.pdf", edition: "À confirmer selon l’annexe nationale" } satisfies RegulatoryRule;
const BAEL = { code: "BAEL 91 révisé 99", label: "BAEL — béton armé", status: "adapted", note: "Référentiel historique francophone à confirmer avec le maître d’œuvre et l’autorité locale.", actions: ["BAEL — béton armé", "Règles de charges locales", "Étude géotechnique", "Annexes nationales applicables"], concrete: "Spécification locale / EN 206" } satisfies RegulatoryRule;
const SANS = { code: "SANS 10160 + SANS 10100", label: "Normes sud-africaines", status: "national", note: "Référentiel sud-africain proposé pour les projets relevant de la réglementation sud-africaine.", actions: ["SANS 10160 — actions", "SANS 10100 — béton", "SANS 10100-1 — bases de conception", "Étude géotechnique"], concrete: "SANS 50197 / spécification locale", source: "https://www.scielo.org.za/scielo.php?pid=S1021-20192017000400001&script=sci_arttext", edition: "SANS 10160-3 à confirmer selon l’édition du projet" } satisfies RegulatoryRule;
const BRITISH = { code: "BS 8110 / BS 6399 — à confirmer", label: "Référentiel britannique historique", status: "to-confirm", note: "Ne pas appliquer automatiquement : confirmer la réglementation nationale et les documents contractuels.", actions: ["BS 6399 — actions", "BS 8110 — béton", "Données locales de vent et séisme", "Étude géotechnique"], concrete: "Spécification nationale" } satisfies RegulatoryRule;

export const REGULATORY_RULES: Record<string, RegulatoryRule> = {
  "Afrique du Sud": SANS,
  "Algérie": EURO,
  "Maroc": EURO,
  "Tunisie": EURO,
  "Égypte": { ...EURO, code: "ECP + EN 1990/1991 — à confirmer", label: "ECP — Egyptian Code of Practice", status: "national", note: "Le code ECP et ses éditions applicables doivent être confirmés selon le projet.", concrete: "ECP béton / spécification locale" },
  "Nigeria": { ...BRITISH, code: "NCP + EN/BS — à confirmer", label: "Nigerian National Building Code", status: "to-confirm", note: "Confirmer le code national, les annexes locales et l’autorité compétente.", concrete: "Spécification nationale" },
  "Ghana": { ...BRITISH, code: "GSA / EN-BS — à confirmer", label: "Référentiel Ghana — à confirmer", status: "to-confirm", note: "Le référentiel doit être confirmé dans le dossier de permis et les documents contractuels.", concrete: "Spécification nationale" },
  "Côte d’Ivoire": { ...BAEL, code: "BAEL / Eurocodes — à confirmer", label: "Référentiel francophone ivoirien", status: "to-confirm", note: "Proposition de travail à valider par l’ingénieur local et l’autorité du projet.", concrete: "Spécification locale / EN 206" },
  "Sénégal": { code: "Loi 2023-21 + Décret 2024-1495 + référentiel structurel du projet", label: "Code de la Construction du Sénégal", status: "national", note: "Le Code de la Construction sénégalais encadre la qualité, la sécurité, les contrôles, les études techniques et les obligations applicables au projet. Le référentiel de calcul structurel (béton, actions, géotechnique, séisme) doit être explicitement sélectionné et sourcé.", actions: ["Loi n°2023-21 du 29 décembre 2023", "Décret n°2024-1495 du 30 juillet 2024", "Référentiel structurel et annexe applicables au projet", "Étude géotechnique et contrôle technique lorsque requis"], concrete: "Référentiel structurel sélectionné / spécification locale", source: "https://www.archives.sn/docs/codes/code-construction-senegal", edition: "2023 + partie réglementaire 2024" },
  "Mauritanie": { ...BAEL, code: "BAEL / Eurocodes — à confirmer", label: "Référentiel mauritanien à confirmer", status: "to-confirm", note: "Aucun code national structurel confirmé dans le catalogue ; proposition francophone à valider selon le dossier local et les conditions sahariennes.", actions: ["BAEL / Eurocode 2 — proposition", "Règles de charges locales", "Vent et thermique selon site", "Étude géotechnique"], concrete: "Spécification locale / EN 206" },
  "Mali": { ...BAEL, code: "BAEL / Eurocodes — à confirmer", label: "Référentiel malien à confirmer", status: "to-confirm", note: "Aucun code national structurel confirmé dans le catalogue ; proposition francophone à valider par le bureau de contrôle et le maître d’œuvre.", actions: ["BAEL / Eurocode 2 — proposition", "Règles de charges locales", "Vent et thermique selon site", "Étude géotechnique"], concrete: "Spécification locale / EN 206" },
  "Gambie": { ...BRITISH, code: "BS / Eurocodes — à confirmer", label: "Référentiel gambien à confirmer", status: "to-confirm", note: "Proposition issue de l’environnement réglementaire anglophone ; confirmer le code contractuel, les charges locales et l’autorité compétente.", actions: ["BS 8110 / Eurocode 2 — proposition", "BS/EN 1991 — actions à confirmer", "Vent et pluies selon site", "Étude géotechnique"], concrete: "Spécification nationale / EN 206" },
  "Cameroun": { ...BAEL, code: "BAEL / Eurocodes — à confirmer", label: "Référentiel francophone camerounais", status: "to-confirm", note: "Confirmer le référentiel auprès du bureau de contrôle et de l’autorité locale.", concrete: "Spécification locale / EN 206" },
};

export function getRegulatoryRule(country: string): RegulatoryRule {
  return REGULATORY_RULES[country] ?? { ...EURO, status: "to-confirm", note: "Aucune règle nationale confirmée dans le catalogue GcBtp : validation obligatoire par l’ingénieur local." };
}

const GFDRR_SOURCE = "https://www.gfdrr.org/en/publication/building-regulations-sub-saharan-africa";
const SANS_SOURCE = "https://www.scielo.org.za/scielo.php?pid=S1021-20192017000400001&script=sci_arttext";

export function getRegulatorySiteProfile(country: string, city = ""): RegulatorySiteProfile {
  const rule = getRegulatoryRule(country);
  const isSouthAfrica = country === "Afrique du Sud";
  const cityLabel = city.trim();
  const climate = getCityClimateProfile(country, city) ?? { country, city: cityLabel || "Ville non renseignée", climateZone: "à déterminer", windExposure: "à déterminer", rainfallExposure: "à déterminer", snow: { groundLoad: 0, status: "to-confirm" as const }, seismic: { zone: "À confirmer", status: "to-confirm" as const }, wind: { ...(isSouthAfrica ? { zone: "À extraire de SANS 10160-3" } : {}), status: "to-confirm" as const }, source: "Catalogue climatique GcBtp — à compléter", note: "Renseigner une ville du catalogue ou confirmer les données auprès d’une source locale." };
  const warnings = [
    "Les zones de vent, neige et séisme doivent être renseignées ou confirmées à partir du texte applicable et de l’étude locale.",
    "Les valeurs provisoires ne doivent pas être utilisées seules pour un permis, une exécution ou une signature.",
  ];
  const preferredNorm = country === "Gambie" ? "BS 8110" : country === "Sénégal" ? "Eurocode 2" : "BAEL 91 mod. 99";
  const constructionContext = country === "Gambie" ? "Béton armé courant, maçonnerie de remplissage, climat tropical côtier ; charges de pluie et vent à confirmer par site." : country === "Mauritanie" ? "Béton armé et maçonnerie courante, climat saharien/aride ; thermique, vent, sable et sol à confirmer par site." : country === "Mali" ? "Béton armé et maçonnerie courante, climat soudano-sahélien ; thermique, vent et sol à confirmer par site." : "Béton armé et maçonnerie courante, climat côtier/sahélien ; vent, corrosion et sol à confirmer par site.";
  return {
    country,
    city: cityLabel || undefined,
    rule,
    preferredNorm,
    constructionContext,
    climate,
    wind: climate.wind,

    seismic: climate.seismic,
    snow: climate.snow,
    provenance: { source: isSouthAfrica ? SANS_SOURCE : (rule.source ?? GFDRR_SOURCE), authority: "À confirmer par l’autorité compétente ou le bureau de contrôle" },
    warnings,
  };
}
