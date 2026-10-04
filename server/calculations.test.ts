import { describe, expect, it } from "vitest";

type BeamInput = { length: number; width: number; height: number; count?: number };
function beamResult(input: BeamInput) {
  const volume = input.length * input.width * input.height * (input.count ?? 1);
  const formwork = 2 * (input.width + input.height) * input.length * (input.count ?? 1);
  return { volume: Math.round(volume * 100) / 100, formwork: Math.round(formwork * 100) / 100 };
}
function estimateTotal(lines: Array<{ quantity: number; unitPrice: number }>, taxRate: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  return { subtotal, total: subtotal * (1 + taxRate / 100) };
}

describe("GcBtp calculation engine", () => {
  it("calculates a beam volume and formwork transparently", () => {
    expect(beamResult({ length: 5, width: 0.25, height: 0.45 })).toEqual({ volume: 0.56, formwork: 7 });
  });

  it("supports quantities for repeated structural elements", () => {
    expect(beamResult({ length: 5, width: 0.25, height: 0.45, count: 4 }).volume).toBe(2.25);
  });

  it("calculates a DQE subtotal and tax-inclusive total", () => {
    expect(estimateTotal([{ quantity: 10, unitPrice: 2500 }, { quantity: 4, unitPrice: 12500 }], 18)).toEqual({ subtotal: 75000, total: 88500 });
  });
});
