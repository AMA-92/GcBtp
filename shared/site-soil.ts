export type SoilProposal = { soil: string; qadm: string; groundwater: string; status: "provisoire"; basis: string };

export function proposeSoil(country: string, city: string, location: string): SoilProposal {
  const text = `${country} ${city} ${location}`.toLowerCase();
  if (/lagos|tanger|casablanca|alexandrie|delta|cotonou/.test(text)) return { soil: "Sol sablo-limoneux / alluvial", qadm: "120 kPa", groundwater: "Nappe potentiellement proche — à confirmer", status: "provisoire", basis: "Proposition régionale, non substitutive à une étude géotechnique" };
  if (/dakar|nouakchott|tunis|windhoek|gaborone/.test(text)) return { soil: "Sol sableux", qadm: "180 kPa", groundwater: "Nappe non déduite — à confirmer", status: "provisoire", basis: "Proposition régionale, non substitutive à une étude géotechnique" };
  if (country === "Côte d’Ivoire" && /abidjan/.test(text)) return { soil: "Sol latéritique / argilo-sableux", qadm: "150 kPa", groundwater: "Nappe variable — à confirmer", status: "provisoire", basis: "Proposition régionale, non substitutive à une étude géotechnique" };
  return { soil: "Sol à portance moyenne", qadm: "150 kPa", groundwater: "Nappe à confirmer", status: "provisoire", basis: "Aucune donnée géotechnique locale fournie" };
}
