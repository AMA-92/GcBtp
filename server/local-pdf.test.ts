import { describe, expect, it } from "vitest";
import { buildLocalPdf } from "../shared/local-pdf";

describe("local PDF export", () => {
  it("builds a downloadable PDF without a user session", () => {
    const pdf = buildLocalPdf("Rapport GcBtp", "Gk : 120 kN\nQk : 80 kN\nAvertissement : validation ingénieur");
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    const text = new TextDecoder().decode(pdf);
    expect(header).toBe("%PDF-1.4");
    expect(text).toContain("Rapport GcBtp");
    expect(text).toContain("Avertissement");
    expect(pdf.byteLength).toBeGreaterThan(200);
  });

  it("preserves a canonical preview string without inserting an extra title or truncating pages", () => {
    const content = "Canonical report title\nStructural Passport - P1\n" + Array.from({ length: 70 }, (_, index) => `Line ${index + 1}`).join("\n");
    const text = new TextDecoder().decode(buildLocalPdf("Canonical report title", content));
    expect((text.match(/\(Canonical report title\) Tj/g) ?? [])).toHaveLength(1);
    expect(text).toContain("Structural Passport - P1");
    expect(text).toContain("Line 70");
    expect(text).toContain("/Count 2");
  });

  it("transliterates French accents and engineering punctuation instead of emitting question marks", () => {
    const text = new TextDecoder().decode(buildLocalPdf("Note de calcul", "Aucune validation par un ingénieur habilité\nRésultat pré-étude · portée 4.00 × 3.00 m"));
    expect(text).toContain("ingenieur habilite");
    expect(text).toContain("Resultat pre-etude | portee 4.00 x 3.00 m");
    expect(text).not.toContain("ing?nieur");
  });
});

  it("adds a dedicated monolithic stair schema page when stairs are reported", () => {
    const pdf = buildLocalPdf("Note de calcul — Escaliers", "Escaliers : deux volées en dalle pleine BA 15 cm\nPaillasse : 2.00 × 1.00 m\nContinuité monolithique");
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain("SCHEMA TECHNIQUE - ESCALIER MONOLITHIQUE");
    expect(text).toContain("PAILLASSE 2.00 x 1.00 m");
    expect(text).toContain("/Count 2");
  });
