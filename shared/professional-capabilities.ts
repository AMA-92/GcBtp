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
{id:8,name:'Poutres BA avancées',status:'implemented-parametric',description:'Flexion, cisaillement, torsion indicative et armatures requises.',validation:'Cas de poutres analytiques.'},
{id:9,name:'Poteaux PMM',status:'implemented-parametric',description:'Contrôle N-Mx-My paramétrique et élancement.',validation:'Cas de capacité axiale.'},
{id:10,name:'Dalles/poinçonnement',status:'implemented-parametric',description:'Contrôle de poinçonnement et surfaces critiques paramétriques.',validation:'Cas de poteau centré/excentré.'},
{id:11,name:'Voiles',status:'implemented-parametric',description:'Capacité axiale, cisaillement et ratios d’armatures indicatifs.',validation:'Cas de voile simple.'},
{id:12,name:'Escaliers',status:'implemented-parametric',description:'Paillasse avec charges, flexion, cisaillement et acier requis.',validation:'Cas de paillasse simple.'},
{id:13,name:'Fondations et géotechnique',status:'implemented-parametric',description:'Pressions excentrées, portance paramétrique et tassement élastique.',validation:'Cas de semelle centrée/excentrée.'},
{id:14,name:'Detailing et nomenclature acier',status:'implemented-parametric',description:'Choix de diamètres, espacement, cadres et masse acier.',validation:'Placement constructible des barres.'},
{id:15,name:'Validation, rapport et performance',status:'implemented-parametric',description:'Suite de références, API de rapport et squelette sparse ; validation réglementaire complète à compléter par code.',validation:'Cas analytiques automatisés.'},
];
