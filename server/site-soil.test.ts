import { describe, expect, it } from "vitest";
import { proposeSoil } from "../shared/site-soil";

describe("proposeSoil", () => {
  it.each([
    ["Sénégal", "Dakar", "Plateau"],
    ["Sénégal", "Mbour", "Centre"],
    ["Mauritanie", "Nouakchott", "Centre"],
    ["Mali", "Bamako", "Centre"],
    ["Burkina Faso", "Ouagadougou", "Centre"],
    ["Gambie", "Banjul", "Centre"],
  ])("does not infer geotechnical parameters from %s / %s / %s", (country, city, location) => {
    const proposal = proposeSoil(country, city, location);
    expect(proposal.soil).toMatch(/non renseigné/i);
    expect(proposal.qadm).toMatch(/saisir depuis l’étude/i);
    expect(proposal.groundwater).toMatch(/saisir depuis l’étude/i);
    expect(proposal.status).toBe("provisoire");
    expect(proposal.basis).toMatch(/aucune portance/i);
  });
});
