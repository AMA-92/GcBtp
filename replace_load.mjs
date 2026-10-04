import fs from 'node:fs';
const path = '/home/ubuntu/gcbtp/client/src/components/AndroidWorkspace.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace('import { AFRICAN_COUNTRIES, getRegulatoryRule } from "@shared/regulatory";', 'import { AFRICAN_COUNTRIES, getRegulatoryRule } from "@shared/regulatory";\nimport { calculateLoadDescent, MATERIALS, type LoadCase, type Material } from "@shared/load-engine";');
const start = text.indexOf('function LoadDescentScreen');
const end = text.indexOf('function CalculsScreen', start);
if (start < 0 || end < 0) throw new Error('LoadDescentScreen markers not found');
const replacement = String.raw`function LoadDescentScreen({ onSave }: { onSave: () => void }) {
  const [country, setCountry] = useState<string>('Côte d’Ivoire');
  const [city, setCity] = useState('Abidjan');
  const [structure, setStructure] = useState('Béton armé — bâtiment courant');
  const [material, setMaterial] = useState<Material>('béton armé');
  const [levels, setLevels] = useState('3');
  const [area, setArea] = useState('20');
  const [thickness, setThickness] = useState('0.15');
  const [loads, setLoads] = useState<Record<LoadCase, boolean>>({ permanent: true, exploitation: true, partitions: true, roof: true, wind: false, seismic: false });
  const rule = getRegulatoryRule(country);
  const calc = calculateLoadDescent({ country, city, structure, material, levels: Math.max(1, Number(levels) || 1), tributaryArea: Math.max(1, Number(area) || 1), slabThickness: Math.max(0.05, Number(thickness) || 0.15), selectedCases: loads });
  const toggle = (key: LoadCase) => setLoads({ ...loads, [key]: !loads[key] });
  const labels: Record<LoadCase, string> = { permanent: 'Poids propres', exploitation: 'Exploitation', partitions: 'Cloisons', roof: 'Toiture', wind: 'Vent', seismic: 'Séisme' };
  return <>
    <div className="mb-4 rounded-[14px] bg-[#102f45] p-5 text-white"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#8dd6d4]"><Wrench className="h-4 w-4"/>Dimensionnement réglementaire</div><h2 className="mt-2 text-[20px] font-bold">Descente de charges</h2><p className="mt-1 text-[11px] leading-4 text-white/75">Le pays guide le référentiel proposé. L’ingénieur valide toujours la norme finale.</p></div>
    <Card className="border-white"><CardHeader><CardTitle className="text-[16px]">Projet et référentiel</CardTitle></CardHeader><CardContent className="space-y-3">
      <div><Label className="text-[11px]">Pays du projet</Label><select className="mt-1 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]" value={country} onChange={e => setCountry(e.target.value)}>{AFRICAN_COUNTRIES.map(item => <option key={item}>{item}</option>)}</select></div>
      <div><Label className="text-[11px]">Ville / emplacement</Label><Input className="mt-1 h-10 text-[12px]" value={city} onChange={e => setCity(e.target.value)} placeholder="Ville, quartier ou coordonnées"/></div>
      <div><Label className="text-[11px]">Type de structure</Label><select className="mt-1 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]" value={structure} onChange={e => setStructure(e.target.value)}><option>Béton armé — bâtiment courant</option><option>Maçonnerie porteuse</option><option>Structure métallique</option><option>Structure mixte</option></select></div>
      <div><Label className="text-[11px]">Matériau / système porteur</Label><select className="mt-1 h-10 w-full rounded-md border border-[#e2e8eb] bg-white px-3 text-[12px]" value={material} onChange={e => setMaterial(e.target.value as Material)}>{Object.entries(MATERIALS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
      <div className="grid grid-cols-3 gap-2"><div><Label className="text-[10px]">Niveaux</Label><Input className="mt-1 h-10 text-[12px]" type="number" min="1" value={levels} onChange={e => setLevels(e.target.value)}/></div><div><Label className="text-[10px]">Aire (m²)</Label><Input className="mt-1 h-10 text-[12px]" type="number" value={area} onChange={e => setArea(e.target.value)}/></div><div><Label className="text-[10px]">Dalle (m)</Label><Input className="mt-1 h-10 text-[12px]" type="number" value={thickness} onChange={e => setThickness(e.target.value)}/></div></div>
      <div className="rounded-lg bg-[#eaf4f5] p-3"><div className="text-[10px] font-bold uppercase text-[#49777b]">Référentiel proposé</div><div className="mt-1 text-[13px] font-bold text-[#102f45]">{rule.label}</div><div className="mt-1 text-[11px] text-[#597174]">{rule.code} · statut : {rule.status === 'to-confirm' ? 'à confirmer' : rule.status}</div><p className="mt-2 text-[10px] leading-4 text-[#597174]">{rule.note}</p></div>
    </CardContent></Card>
    <Card className="mt-4 border-white"><CardHeader><CardTitle className="text-[16px]">Cas de charges</CardTitle><p className="text-[11px] text-[#858585]">Sélectionnez uniquement les actions justifiées par le projet.</p></CardHeader><CardContent className="grid grid-cols-2 gap-2">{(Object.keys(labels) as LoadCase[]).map(key => <button key={key} onClick={() => toggle(key)} className={loads[key] ? 'rounded-lg border p-3 text-left text-[11px] font-semibold border-[#079ca0] bg-[#eaf4f5] text-[#0b747a]' : 'rounded-lg border p-3 text-left text-[11px] font-semibold border-[#e5e5e5] bg-white text-[#858585]'}>{loads[key] ? '✓ ' : '○ '}{labels[key]}</button>)}</CardContent></Card>
    <Card className="mt-4 border-white"><CardHeader><CardTitle className="text-[16px]">Chaîne de transfert</CardTitle></CardHeader><CardContent><div className="grid grid-cols-4 gap-1 text-center">{[["Plancher", calc.chain.floor], ["Poutre", calc.chain.beam], ["Poteau", calc.chain.column], ["Fondation", calc.chain.foundation]].map(([label, value], i) => <div key={String(label)}><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#079ca0] text-[10px] font-bold text-white">{i + 1}</div><div className="mt-2 text-[10px] font-bold">{label}</div><div className="mt-1 text-[10px] text-[#079ca0]">{Number(value).toFixed(1)} kN</div>{i < 3 && <div className="relative -right-8 -top-7 text-[#ef8a54]">→</div>}</div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#fff8e8] p-3"><div className="text-[10px] uppercase text-[#8d7643]">Fondation</div><div className="mt-1 text-[18px] font-bold text-[#6a5525]">{calc.chain.foundation.toFixed(1)} kN</div></div><div className="rounded-lg bg-[#eaf4f5] p-3"><div className="text-[10px] uppercase text-[#59777a]">Combinaison</div><div className="mt-1 text-[11px] font-bold text-[#0b747a]">{calc.combination}</div></div></div><div className="mt-3 rounded-lg bg-[#fff1ed] p-3 text-[10px] leading-4 text-[#914d3d]">Hypothèses : Gk {calc.assumptions.gk.toFixed(2)} kN, Qk {calc.assumptions.qk.toFixed(2)} kN, γG {calc.assumptions.gammaG.toFixed(2)}, γQ {calc.assumptions.gammaQ.toFixed(2)}. Vent, séisme, sol et annexes nationales doivent être confirmés avant signature.</div><Button onClick={onSave} className="mt-3 w-full bg-[#102f45] text-white"><FileText className="mr-2 h-4 w-4"/>Générer la note de calcul</Button></CardContent></Card>
  </>;
}
`;
text = text.slice(0, start) + replacement + text.slice(end);
fs.writeFileSync(path, text);
