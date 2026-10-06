import { DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA, DEFAULT_PROJECT_ALLOWABLE_BEARING_SOURCE } from "./foundation-engine";

export type SoilProposal = { soil: string; qadm: string; groundwater: string; status: "provisoire"; basis: string };

/**
 * Une ville ou une région ne suffit pas à déduire les paramètres géotechniques.
 * GcBtp ne fournit donc qu'une hypothèse de projet explicitement provisoire.
 */
export function proposeSoil(_country: string, _city: string, _location: string): SoilProposal {
  return {
    soil: "Sol non caractérisé",
    qadm: `${DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA} kPa`,
    groundwater: "Nappe et paramètres à confirmer par l'étude géotechnique",
    status: "provisoire",
    basis: `${DEFAULT_PROJECT_ALLOWABLE_BEARING_SOURCE} — la localisation seule ne permet pas de déduire la portance du sol`,
  };
}
