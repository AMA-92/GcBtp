export type CapabilityStatus='implemented'|'implemented-parametric'|'integrated-warning'|'planned';
export type EngineeringCapability={id:number;name:string;status:CapabilityStatus;description:string;validation:string};
export const PROFESSIONAL_CAPABILITIES:EngineeringCapability[]=[
{id:1,name:'Modèle analytique et éléments 3D',status:'implemented',description:'Nœuds, barres, appuis, releases, excentrements, diaphragmes et contrôle de connectivité.',validation:'Tests de géométrie et solveur 3D.'},
{id:2,name:'FEM dalles Mindlin Q4',status:'implemented-parametric',description:'Plaques linéaires w-rx-ry avec intégration réduite du cisaillement.',validation:'Conservation de charge sur panneaux supportés.'},
{id:3,name:'Affectation structurée des charges',status:'implemented-parametric',description:'Patterns, assignments nodaux, linéiques et surfaciques avec provenance.',validation:'Validation des affectations et conservation des charges.'},
{id:4,name:'Analyse modale',status:'implemented-parametric',description:'Valeurs propres et vecteurs propres à partir de K et M avec participation modale.',validation:'Matrice symétrique de référence.'},
{id:5,name:'Response Spectrum SRSS/CQC',status:'implemented-parametric',description:'Interpolation de spectre et combinaison modale.',validation:'Cas spectraux unitaires.'},
{id:6,name:'Vent',status:'implemented-parametric',description:'Pression dynamique, pression nette et forces par étage.',validation:'Contrôles d’unités et sensibilité paramétrique.'},
{id:7,name:'Séisme',status:'implemented-parametric',description:'Forces latérales équivalentes et distribution par masse/hauteur.',validation:'Conservation du cisaillement de base.'},
{id:8,name:'Poutres BA avancées',status:'integrated-warning',description:'Flexion et cisaillement paramétriques ; torsion, fissuration, ancrages et dispositions sismiques explicitement bloqués.',validation:'Cas de poutres analytiques ; revue normative requise.'},
{id:9,name:'Poteaux PMM',status:'integrated-warning',description:'Contrôle N-Mx-My paramétrique ; second ordre, confinement et effets sismiques non certifiés.',validation:'Cas de capacité axiale ; revue normative requise.'},
{id:10,name:'Dalles/poinçonnement',status:'integrated-warning',description:'Flexion et poinçonnement paramétriques ; continuité, trémies et détail autour des appuis à vérifier.',validation:'Cas de poteau centré/excentré ; revue normative requise.'},
{id:11,name:'Voiles',status:'integrated-warning',description:'Capacité axiale, cisaillement et ratios d’armatures indicatifs ; détail et interaction à compléter.',validation:'Cas de voile simple ; revue normative requise.'},
{id:12,name:'Escaliers',status:'integrated-warning',description:'Deux volées, paliers et appuis du projet transmis au calcul ; résultat maintenu en pré-étude jusqu’aux vérifications de continuité, service et ancrage.',validation:'Cas sol → palier intermédiaire → poutre d’arrivée.'},
{id:13,name:'Fondations et géotechnique',status:'implemented-parametric',description:'Pressions excentrées, portance paramétrique et tassement élastique.',validation:'Cas de semelle centrée/excentrée.'},
{id:14,name:'Detailing et nomenclature acier',status:'integrated-warning',description:'Diamètres, espacement, cadres, masse, ancrage et recouvrement proposés ; longueurs normatives, crochets et confinement restent à valider.',validation:'Placement constructible paramétrique ; validation professionnelle requise.'},
{id:15,name:'Validation, rapport et performance',status:'integrated-warning',description:'Tests automatisés et rapports avec statut non réglementaire ; références normatives et validation par ingénieur restent obligatoires.',validation:'Cas analytiques automatisés ; aucune certification réglementaire.'},
];
