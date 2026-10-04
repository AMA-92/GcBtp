from pathlib import Path
p=Path('/mnt/data/gcbtp_work/v5/shared/reinforcement-report.ts')
s=p.read_text()
start=s.index('export function groupReinforcementElements')
end=s.index('\nexport function reinforcementElementSummary', start)
new='''export function groupReinforcementElements(elements: RCElementDesign[], geometryById: Record<string, string> = {}) {
  const map = new Map<string, RCElementDesign[]>();
  for (const element of elements) {
    // Une fiche A4 représente UN TYPE de ferraillage. Deux éléments ne sont
    // donc regroupés que s'ils ont le même type, la même section constructive
    // et exactement le même ferraillage. La fiche montre ensuite uniquement
    // le représentant, avec la quantité et la liste des repères associés.
    const sectionKey = reinforcementGroupingKey(element, geometryById[element.elementId]);
    const key = `${sectionKey}::${reinforcementFingerprint(element)}`;
    const list = map.get(key) ?? [];
    list.push(element);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    type: group[0].type,
    elements: group,
    representative: group[0],
    identicalReinforcement: true,
  } satisfies ReinforcementA4Group));
}
'''
p.write_text(s[:start]+new+s[end:])

p=Path('/mnt/data/gcbtp_work/v5/shared/local-pdf.ts')
s=p.read_text()
s=s.replace('''  const rows = group.identicalReinforcement
    ? representative.reinforcement.map(bar => ({ elementId: `${group.elements.length} x ${group.elements.map(e => e.elementId).join(", ")}`, bar }))
    : group.elements.flatMap(element => element.reinforcement.map(bar => ({ elementId: element.elementId, bar })));
''','''  // Le dessin et la nomenclature représentent un seul élément type (le représentant).
  // La quantité et les repères sont indiqués séparément dans le cartouche technique.
  const rows = representative.reinforcement.map(bar => ({ elementId: representative.elementId, bar }));
''')
s=s.replace('''  if (rows.length > 10) commands.push(a4Text(`... ${rows.length - 10} ligne(s) supplémentaire(s) dans le détail numérique.`, margin + 8, 123, 6));
''','''  if (rows.length > 10) commands.push(a4Text(`... ${rows.length - 10} ligne(s) supplémentaire(s) dans le détail numérique.`, margin + 8, 123, 6));
  commands.push(a4Text(`ELEMENT REPRESENTATIF : ${representative.elementId} · QUANTITE : ${group.elements.length}`, margin + 8, 135, 6.5, true));
''')
s=s.replace('''  commands.push(a4Text(`${group.elements.length} élément(s) de même type et section`, margin + 110, 518, 7, true));
''','''  commands.push(a4Text(`ELEMENT TYPE REPRESENTATIF · QUANTITE : ${group.elements.length}`, margin + 110, 518, 7, true));
''')
s=s.replace('''    `Nombre : ${group.elements.length}`,
    `Repères (${group.elements.length}) : ${idChunks[0] || "—"}`,
''','''    `Quantité : ${group.elements.length} élément(s) identique(s)`,
    `Repères associés : ${idChunks[0] || "—"}`,
''')
s=s.replace('''    group.identicalReinforcement ? "Ferraillage commun : identique pour tous les repères." : "VARIANTES : les repères ont la même section mais des ferraillages différents ; voir le tableau.",
''','''    "Le présent plan représente UN SEUL élément type. Les autres repères ci-dessus ont exactement le même ferraillage.",
''')
p.write_text(s)

p=Path('/mnt/data/gcbtp_work/v5/server/reinforcement-report.test.ts')
s=p.read_text()
s=s.replace('''  it("garde une seule fiche pour une même section même si le ferraillage varie", () => {
''','''  it("crée une fiche distincte lorsque la même section possède un ferraillage différent", () => {
''')
s=s.replace('''    expect(result).toHaveLength(1);
    expect(result[0].identicalReinforcement).toBe(false);
''','''    expect(result).toHaveLength(2);
    expect(result[0].elements).toHaveLength(1);
    expect(result[1].elements).toHaveLength(1);
''',1)
s += '''\n\ndescribe("plans A4 représentatifs", () => {\n  it("produit trois fiches représentatives pour trois sections de poteaux", () => {\n    const result = groupReinforcementElements(\n      [element("P1", "column", 4), element("P2", "column", 4), element("P3", "column", 4), element("P11", "column", 6), element("P12", "column", 6), element("P18", "column", 8)],\n      {\n        P1: "Section : 150 × 150 mm · longueur 3 200 mm", P2: "Section : 150 × 150 mm · longueur 3 200 mm", P3: "Section : 150 × 150 mm · longueur 3 200 mm",\n        P11: "Section : 200 × 200 mm · longueur 3 200 mm", P12: "Section : 200 × 200 mm · longueur 3 200 mm",\n        P18: "Section : 300 × 300 mm · longueur 3 200 mm",\n      },\n    );\n    expect(result).toHaveLength(3);\n    expect(result.map(group => group.elements.length)).toEqual([3, 2, 1]);\n    expect(result[0].representative.elementId).toBe("P1");\n  });\n});\n'''
p.write_text(s)
