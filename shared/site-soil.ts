export type SoilProposal = { soil: string; qadm: string; groundwater: string; status: "provisoire"; basis: string };

/** La localisation ne fournit aucune donnée géotechnique : chaque valeur doit venir du rapport réel du site. */
export function proposeSoil(_country: string, _city: string, _location: string): SoilProposal {
  return {
    soil: "Profil géotechnique non renseigné",
    qadm: "à saisir depuis l’étude",
    groundwater: "niveau de nappe à saisir depuis l’étude",
    status: "provisoire",
    basis: "Aucune portance, stratigraphie ou nappe n’est déduite de la localisation; saisir les valeurs du rapport géotechnique du site.",
  };
}
