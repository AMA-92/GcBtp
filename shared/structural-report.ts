export type StructuralPassport = {
  elementId: string;
  label: string;
  elementType: string;
  levelLabel: string;
  section: string;
  gkKn: number;
  qkKn: number;
  nuKn: number;
  nserKn: number;
  momentKnM: number | null;
  supports: string[];
  sources: string[];
};

export type StructuralReportSection = { title: string; lines: string[] };
export type StructuralReportDocument = {
  schemaVersion: 1;
  status: "pré-étude — non certifié";
  title: string;
  generatedAt: string;
  project: { id: string; name: string; country: string; city: string; location: string; structure: string; norm: string };
  body: string;
  passports: StructuralPassport[];
  sections: StructuralReportSection[];
  validation: { engineer: "non renseigné"; statement: string };
};

export function createStructuralPassport(input: StructuralPassport): StructuralPassport {
  return { ...input, supports: [...input.supports], sources: [...input.sources] };
}

export function renderStructuralPassport(passport: StructuralPassport): string[] {
  return [
    `${passport.label} · ${passport.elementType} · ${passport.levelLabel}`,
    `G ${passport.gkKn.toFixed(2)} kN · Q ${passport.qkKn.toFixed(2)} kN · Nu ${passport.nuKn.toFixed(2)} kN · Nser ${passport.nserKn.toFixed(2)} kN · M ${passport.momentKnM === null ? "—" : `${passport.momentKnM.toFixed(2)} kN·m`}`,
    `Section / modèle : ${passport.section || "non renseigné"}`,
    `Appuis / transfert : ${passport.supports.length ? passport.supports.join(", ") : "aucun appui direct identifié"}`,
    `Sources : ${passport.sources.length ? passport.sources.slice(0, 8).join("; ") : "aucune source détaillée enregistrée"}`,
  ];
}

export function createStructuralReport(input: Omit<StructuralReportDocument, "schemaVersion" | "status" | "validation">): StructuralReportDocument {
  return {
    schemaVersion: 1,
    status: "pré-étude — non certifié",
    ...input,
    passports: input.passports.map(createStructuralPassport),
    sections: input.sections.map(section => ({ title: section.title, lines: [...section.lines] })),
    validation: {
      engineer: "non renseigné",
      statement: "Aucune validation par un ingénieur habilité n’a été enregistrée. Ce rapport ne constitue ni une note d’exécution ni une attestation réglementaire.",
    },
  };
}

/** Canonical content consumed by report preview, local PDF, server PDF, and JSON archive. */
export function renderStructuralReport(document: StructuralReportDocument): string {
  return [
    document.title,
    "GcBtp — Rapport structurel unifié",
    `Statut : ${document.status}`,
    `Généré le : ${document.generatedAt}`,
    `Projet : ${document.project.name} (${document.project.id}) · ${document.project.country} · ${document.project.city || "ville non renseignée"} · ${document.project.location || "site non renseigné"}`,
    `Structure : ${document.project.structure} · référentiel déclaré : ${document.project.norm}`,
    "",
    document.body,
    ...document.sections.flatMap(section => ["", section.title.toUpperCase(), ...section.lines]),
    "",
    "STRUCTURAL PASSPORT — SYNTHÈSE DES ÉLÉMENTS",
    ...document.passports.flatMap(passport => ["", ...renderStructuralPassport(passport)]),
    "",
    "VALIDATION",
    document.validation.statement,
  ].join("\n");
}
