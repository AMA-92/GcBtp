import { describe, expect, it } from "vitest";
import { designMasonryWall } from "../shared/masonry-design";

describe("contrôles maçonnerie", () => {
  it("contrôle compression, cisaillement, élancement et excentricité", () => {
    const r = designMasonryWall({id:'M1',heightM:3,lengthM:4,thicknessMm:200,axialKn:80,shearKn:8,compressiveStrengthMpa:7,shearStrengthMpa:.25,verticalTieSpacingM:3,horizontalTieSpacingM:3});
    expect(r.checks.map(c=>c.id)).toEqual(expect.arrayContaining(['masonry-compression','masonry-shear','masonry-slenderness','masonry-eccentricity']));
  });
});
