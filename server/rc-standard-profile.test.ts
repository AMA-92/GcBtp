import { describe, expect, it } from "vitest";
import { resolveRCStandardProfile, sameRCStandardFamily } from "@shared/rc-standard-profile";

describe("selected reinforced-concrete standard profile", () => {
  it("recognizes the BAEL project setting", () => {
    expect(resolveRCStandardProfile("BAEL 91 mod. 99")).toMatchObject({ family: "bael-91-99", supportedForPreDesign: true, suggestedAlphaCC: 1 });
  });

  it("recognizes the Eurocode 2 project setting and aliases", () => {
    expect(resolveRCStandardProfile("Eurocode 2")).toMatchObject({ family: "eurocode-2", supportedForPreDesign: true, suggestedAlphaCC: 0.85 });
    expect(sameRCStandardFamily("Eurocode 2", "Eurocode 2 · EN 1992-1-1")).toBe(true);
  });

  it("does not treat other project standards as Eurocode", () => {
    expect(resolveRCStandardProfile("BS 8110").supportedForPreDesign).toBe(false);
    expect(sameRCStandardFamily("SANS 10100", "ECP · code égyptien")).toBe(false);
  });
});
