import { describe, expect, it } from "vitest";
import { columnBaseElevation, elementElevation, isFoundationLevel, levelElevation, levelHeight, levelIndexShift, postTopElevation } from "../shared/vertical-structure";

describe("hiérarchie verticale de la structure", () => {
  const foundation = { id: "foundation", label: "Fondations", elevation: "0", height: "1.2" };
  const rdc = { id: "rdc", label: "RDC", elevation: "1.2", height: "3.4" };

  it("respecte l’altitude et la hauteur de niveau", () => {
    expect(levelElevation(rdc, 1)).toBe(1.2);
    expect(levelHeight(rdc)).toBe(3.4);
    expect(isFoundationLevel(foundation)).toBe(true);
  });

  it("place les éléments dans l’ordre vertical attendu", () => {
    expect(elementElevation(foundation, 0, "Semelle")).toBeLessThan(elementElevation(foundation, 0, "Poteau"));
    expect(elementElevation(rdc, 1, "Poteau")).toBeLessThan(elementElevation(rdc, 1, "Poutre"));
    expect(elementElevation(rdc, 1, "Poutre")).toBe(postTopElevation(rdc, 1));
    expect(elementElevation(foundation, 0, "Poutre")).toBe(postTopElevation(foundation, 0));
    expect(elementElevation(rdc, 1, "Poutre")).toBe(elementElevation(rdc, 1, "Dalle"));
  });

  it("donne aux poteaux la longueur du niveau actif", () => {
    expect(postTopElevation(rdc, 1) - levelElevation(rdc, 1)).toBeCloseTo(3.4, 6);
    expect(postTopElevation(foundation, 0) - levelElevation(foundation, 0)).toBeCloseTo(0.85, 6);
  });

  it("calcule une translation distincte depuis le niveau source", () => {
    const levels = [foundation, rdc, { id: "r1", label: "R+1", elevation: "4.6", height: "3.1" }, { id: "r2", label: "R+2", elevation: "7.7", height: "3.1" }];
    expect(levelIndexShift(levels, "rdc", "r1")).toBe(1);
    expect(levelIndexShift(levels, "rdc", "r2")).toBe(2);
    expect(levelIndexShift(levels, "rdc", "rdc")).toBe(0);
  });

  it("raccorde le pied de chaque poteau au niveau précédent", () => {
    const levels = [foundation, rdc, { id: "r1", label: "R+1", elevation: "4.6", height: "3.1" }];
    expect(columnBaseElevation(levels, 0)).toBeCloseTo(-0.17, 6);
    expect(columnBaseElevation(levels, 1)).toBeCloseTo(postTopElevation(foundation, 0), 6);
    expect(columnBaseElevation(levels, 2)).toBeCloseTo(postTopElevation(rdc, 1), 6);
  });

  it("place une longrine de fondation à la même cote que les pieds des poteaux", () => {
    expect(elementElevation(foundation, 0, "Longrine de redressement")).toBeCloseTo(columnBaseElevation([foundation], 0), 6);
    expect(elementElevation(rdc, 1, "Longrine de redressement")).toBeCloseTo(levelElevation(rdc, 1) - 0.35, 6);
  });
});
