import { describe, expect, it } from "vitest";
import { buildAnalyticalModel } from "@shared/analytical-model";
import { meshAnalyticalSurfaces } from "@shared/analytical-surface-mesh";
import { MODEL_CATALOG } from "@shared/model-catalog";

const makeModel = () => buildAnalyticalModel({
  levels: [
    { id: "foundation", label: "Fondation", elevation: "-1", height: "1", elements: [
      { id: "F1", type: "Semelle", section: "Semelle_100x100", x: 0, y: 0 },
      { id: "F2", type: "Semelle", section: "Semelle_100x100", x: 1, y: 0 },
    ] },
    { id: "rdc", label: "RDC", elevation: "0", height: "3.2", elements: [
      { id: "C1", type: "Poteau", section: "Pot_30x30", x: 0, y: 0 },
      { id: "C2", type: "Poteau", section: "Pot_30x30", x: 1, y: 0 },
      { id: "B1", type: "Poutre", section: "Poutre_20x40", x: 0, y: 0, x2: 1, y2: 0 },
      { id: "D1", type: "Dalle", section: "Dalle_16+4", x: 0, y: 0, x2: 1, y2: 1 },
    ] },
  ],
  xDistancesM: [4, 4, 4],
  yDistancesM: [4, 4, 4],
  structure: "Béton armé",
  modelCatalog: MODEL_CATALOG,
});

describe("maillage géométrique des surfaces analytiques", () => {
  it("maille toutes les surfaces et produit des triangles de surface positifs", () => {
    const { model } = makeModel();
    const mesh = meshAnalyticalSurfaces(model, 0.75);
    expect(mesh.errors).toEqual([]);
    expect(mesh.surfaces).toHaveLength(model.surfaces.length);
    expect(mesh.surfaces.length).toBeGreaterThan(0);
    expect(mesh.surfaces.every(surface => surface.triangleCount > 0 && surface.nodeCount >= 3)).toBe(true);
    expect(mesh.triangles.every(triangle => triangle.areaM2 > 0)).toBe(true);
    expect(new Set(mesh.triangles.map(triangle => triangle.id)).size).toBe(mesh.triangles.length);
  });

  it("refuse une taille hors bornes au lieu de déclarer le maillage validé", () => {
    const mesh = meshAnalyticalSurfaces(makeModel().model, 0.01);
    expect(mesh.errors).toContain("La taille de maille doit être comprise entre 0,10 et 10 m.");
    expect(mesh.triangles).toEqual([]);
  });

  it("bloque un contour d’aire nulle avec un seul diagnostic par surface", () => {
    const { model } = makeModel();
    const surface = model.surfaces[0];
    const degenerateNodeIds = surface.nodeIds.map((_, index) => `degenerate-${index}`);
    const degenerateNodes = surface.nodeIds.map((nodeId, index) => {
      const original = model.nodes.find(node => node.id === nodeId)!;
      return { ...original, id: degenerateNodeIds[index], x: index, y: 0, z: 0 };
    });
    const degenerateModel = {
      ...model,
      nodes: [...model.nodes, ...degenerateNodes],
      surfaces: model.surfaces.map((item, index) => index === 0 ? { ...item, nodeIds: degenerateNodeIds } : item),
    };
    const mesh = meshAnalyticalSurfaces(degenerateModel, 0.75);
    const failedSurface = mesh.surfaces.find(item => item.surfaceId === surface.id)!;
    expect(failedSurface.triangleCount).toBe(0);
    expect(failedSurface.errors).toEqual(["Le contour est de surface nulle ou dégénéré ; corrigez les sommets de la surface."]);
  });
});
