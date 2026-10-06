import { describe, expect, it } from "vitest";
import { proposeSoil } from "../shared/site-soil";
import { DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA } from "../shared/foundation-engine";

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
    expect(proposal.soil).toBe("Sol non caractérisé");
    expect(proposal.qadm).toBe(`${DEFAULT_PROJECT_ALLOWABLE_BEARING_KPA} kPa`);
    expect(proposal.status).toBe("provisoire");
    expect(proposal.groundwater).toMatch(/étude géotechnique/i);
    expect(proposal.basis).toMatch(/localisation seule ne permet pas/i);
  });
});
