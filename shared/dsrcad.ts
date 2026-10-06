import { FRENCH_EUROCODE_DEFAULT_STANDARD } from "./french-standard-profile";

export const DSRCAD_MODULES = [
  "Dosage Béton",
  "Volumes de Béton",
  "Surfaces de Coffrage Poutres",
  "Ferraillages Minimaux",
  "Moment Maximal",
  "Estimation de Coûts",
  "Calcul d’Escalier",
  "Calcul Agglos",
  "Calcul Mortier",
  "Devis DQE BTP",
  "Calcul Poteau",
  "Calcul Poutre",
  "Calcul Semelle",
  "Calcul Plancher",
  "Planning",
  "Gestion de Chantier",
  "AI Vision",
  "Bâtiment",
] as const;

export const DSRCAD_DEFAULT_PLANNING = {
  title: "Planning Gros Œuvre",
  description: "Organisation des travaux et jalons de chantier",
  reference: "LOT-01",
  location: "Dakar",
  tasks: ["Installation de chantier", "Fondations", "Élévation des murs"],
} as const;

export const DSRCAD_NORMS = [FRENCH_EUROCODE_DEFAULT_STANDARD, "BAEL 91 mod. 99"] as const;
export const DSRCAD_COUNTRIES = ["Sénégal", "Mauritanie", "Mali", "Gambie"] as const;
