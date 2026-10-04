/**
 * Senegal Construction Code catalogue.
 * Primary references: Law n°2023-21 of 29 Dec 2023 and Decree n°2024-1495
 * of 30 Jul 2024 (regulatory part). This module is a compliance gate,
 * not a substitute for the official permit/technical-control process.
 */
export const SENEGAL_CONSTRUCTION_CODE = {
  law: 'Loi n° 2023-21 du 29 décembre 2023 portant Code de la Construction',
  decree: 'Décret n° 2024-1495 du 30 juillet 2024 portant partie réglementaire du Code de la Construction',
  lawSource: 'https://www.archives.sn/docs/codes/code-construction-senegal',
  decreeSource: 'https://juridoc.sn/fr/document/decret-n--2024-1495-du-30-juillet-2024-portant-partie-reglementaire-du-code-de-la-construction/83345',
} as const;

export type SenegalProjectComplianceInput = {
  country: string;
  buildingFloorsAboveGround: number;
  use: string;
  housingUnits?: number;
  publicAccess?: boolean;
  industrialOrCommercial?: boolean;
  cantileverM?: number;
  longestBeamM?: number;
  buriedDepthM?: number;
  foundationDepthM?: number;
  underpinning?: boolean;
  neighbourRetainingWorksHeightM?: number;
  longSpanMetalOrWoodM?: number;
  geotechnicalStudyAvailable?: boolean;
  technicalControlContract?: boolean;
  excavationOpeningAuthorization?: boolean;
};

export type ComplianceCheck = {
  id: string;
  label: string;
  status: 'conforme' | 'requis' | 'a-confirmer' | 'bloquant';
  message: string;
  reference: string;
};

export function evaluateSenegalConstructionCode(input: SenegalProjectComplianceInput): {
  applicable: boolean;
  checks: ComplianceCheck[];
  blockers: string[];
  warnings: string[];
} {
  if (input.country !== 'Sénégal') return { applicable: false, checks: [], blockers: [], warnings: [] };
  const checks: ComplianceCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const technicalControlMandatory = Boolean(
    input.publicAccess || input.industrialOrCommercial || input.buildingFloorsAboveGround >= 3 ||
    (input.housingUnits ?? 0) > 5 || (input.cantileverM ?? 0) > 2 || (input.longestBeamM ?? 0) > 10 ||
    (input.buriedDepthM ?? 0) > 3 || (input.foundationDepthM ?? 0) > 10 || input.underpinning ||
    (input.neighbourRetainingWorksHeightM ?? 0) > 5 || (input.longSpanMetalOrWoodM ?? 0) > 15
  );

  checks.push({ id: 'construction-authorization', label: 'Autorisation de construire', status: 'a-confirmer', message: 'L’autorisation administrative et la conformité urbanistique doivent être vérifiées dans le dossier du projet.', reference: 'Loi 2023-21 — autorisation de construire' });
  checks.push({ id: 'geotechnical-study', label: 'Étude géotechnique', status: input.geotechnicalStudyAvailable ? 'conforme' : 'requis', message: input.geotechnicalStudyAvailable ? 'Étude géotechnique déclarée disponible.' : 'Étude géotechnique à fournir lorsque requise par le projet, les fondations ou le contrôle technique.', reference: 'Loi 2023-21 + dispositions réglementaires applicables aux études techniques' });
  checks.push({ id: 'technical-control', label: 'Contrôle technique', status: technicalControlMandatory ? (input.technicalControlContract ? 'conforme' : 'bloquant') : 'a-confirmer', message: technicalControlMandatory ? (input.technicalControlContract ? 'Contrôle technique obligatoire déclaré et mandaté.' : 'Contrôle technique obligatoire : mandat à renseigner.') : 'Vérifier l’applicabilité du contrôle technique selon les caractéristiques finales.', reference: 'Décret 2024-1495, art. R.76-R.79' });
  checks.push({ id: 'excavation-opening', label: 'Autorisation d’ouverture des fouilles', status: technicalControlMandatory ? (input.excavationOpeningAuthorization ? 'conforme' : 'requis') : 'a-confirmer', message: technicalControlMandatory ? 'À obtenir avant démarrage effectif des travaux lorsque le régime l’exige.' : 'À confirmer selon l’assujettissement du projet.', reference: 'Loi 2023-21 — autorisation d’ouverture des fouilles' });
  checks.push({ id: 'safety', label: 'Solidité et sécurité', status: 'a-confirmer', message: 'La conception doit être vérifiée par les calculs structurels, les études techniques et le contrôle compétent.', reference: 'Loi 2023-21 — qualité et sécurité des constructions' });
  checks.push({ id: 'accessibility', label: 'Accessibilité PMR', status: 'a-confirmer', message: 'Les exigences d’accessibilité doivent être évaluées selon la destination et les caractéristiques du bâtiment.', reference: 'Loi 2023-21 + partie réglementaire' });
  checks.push({ id: 'energy', label: 'Performance énergétique', status: 'a-confirmer', message: 'Les exigences énergétiques applicables doivent être renseignées selon la destination et le texte réglementaire en vigueur.', reference: 'Loi 2023-21 + partie réglementaire' });

  for (const c of checks) if (c.status === 'bloquant') blockers.push(c.message);
  for (const c of checks) if (c.status === 'requis' || c.status === 'a-confirmer') warnings.push(c.message);
  return { applicable: true, checks, blockers, warnings };
}
