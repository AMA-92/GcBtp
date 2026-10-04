import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODEL_CATALOG, mergeModelCatalog, type ModelFamily, type ModelSpec } from "@shared/model-catalog";
import { MODEL_COLOR_PALETTE, normalizeModelColor } from "@shared/model-palette";

type Props = {
  selectedType: string;
  selectedName: string;
  customModels?: ModelSpec[];
  onModelsChange?: (models: ModelSpec[]) => void;
  onSelect: (model: ModelSpec) => void;
};

const builtInFamilies = Array.from(new Set(MODEL_CATALOG.map(item => item.family)));
const familyType = (family: ModelFamily) => family.startsWith("Poteau") ? "Poteau" : family.startsWith("Plancher") ? "Dalle" : family;
const isBuiltIn = (model: ModelSpec) => MODEL_CATALOG.some(item => item.type === model.type && item.name === model.name);

export default function ModelCatalogPanel({ selectedType, selectedName, customModels = [], onModelsChange, onSelect }: Props) {
  const models = useMemo(() => {
    return mergeModelCatalog(customModels);
  }, [customModels]);
  const families = useMemo(() => Array.from(new Set([...builtInFamilies, ...models.map(model => model.family)])), [models]);
  const [editing, setEditing] = useState<ModelSpec | null>(null);
  const [creatingFamily, setCreatingFamily] = useState<ModelFamily | null>(null);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [draft, setDraft] = useState<ModelSpec | null>(null);

  const openEdit = (model: ModelSpec) => { setEditing(model); setDraft({ ...model }); };
  const openCreate = (family: ModelFamily) => { setShowFamilyPicker(false); setCreatingFamily(family); const dimensions = family === "Semelle" ? "1.00 × 1.00 × 0.30 m" : family === "Voile" ? "0.20 × 3.20 m" : family === "Longrine de redressement" ? "0.20 × 0.40 m" : "0.20 × 0.30 m"; setDraft({ family, type: familyType(family), name: "Nouveau modèle", dimensions, color: "#6247a8" }); };
  const closeEditor = () => { setDraft(null); setCreatingFamily(null); setShowFamilyPicker(false); setEditing(null); };
  const save = () => {
    if (!draft || !draft.name.trim() || !draft.dimensions.trim()) return;
    const normalized = { ...draft, name: draft.name.trim(), dimensions: normalizedDimensions(draft), color: normalizeModelColor(draft.color, "#6247a8") };
    const previous = customModels.filter(model => !editing || !(model.type === editing.type && model.name === editing.name));
    onModelsChange?.([...previous, normalized]);
    onSelect(normalized);
    closeEditor();
  };
  const remove = (model: ModelSpec) => {
    if (isBuiltIn(model)) return;
    onModelsChange?.(customModels.filter(item => !(item.type === model.type && item.name === model.name)));
  };
  const dimensionValues = (value: string) => Array.from(value.matchAll(/(\d+(?:[.,]\d+)?)/g)).map(match => match[1].replace(",", "."));
  const updateFootingDimension = (index: number, value: string) => {
    if (!draft) return;
    const values = dimensionValues(draft.dimensions);
    while (values.length < 3) values.push("0.00");
    values[index] = value.replace(",", ".");
    setDraft({ ...draft, dimensions: `${values[0]} × ${values[1]} × ${values[2]} m` });
  };
  const normalizedDimensions = (model: ModelSpec) => {
    const values = dimensionValues(model.dimensions);
    if (model.family === "Semelle") {
      while (values.length < 3) values.push("0.00");
      return `${values.slice(0, 3).map(value => Number(value || 0).toFixed(2)).join(" × ")} m`;
    }
    return `${model.dimensions.replace(/\s*m\s*$/i, "").trim()} m`;
  };

  return <div className="-mx-4 -mb-4 min-h-[640px] bg-[#f7f7f7]">
    <div className="flex items-center gap-3 border-b border-[#ececec] bg-white px-4 py-3"><div className="grid h-8 w-8 place-items-center rounded-full text-[#202025]">‹</div><h2 className="text-[14px] font-bold text-[#202025]">Mes modèles de structures</h2></div>
    <div className="space-y-3 p-3 pb-24">
      {families.map(family => <section key={family}><h3 className="mb-1.5 px-1 text-[11px] font-bold text-[#6c6c70]">{family}</h3><div className="space-y-1.5">{models.filter(item => item.family === family).map(item => <div key={`${item.type}-${item.name}`} className={`flex w-full items-center gap-2 rounded-[11px] bg-white px-2.5 py-2 shadow-[0_2px_6px_rgba(0,0,0,.11)] ${selectedType === item.type && selectedName === item.name ? "ring-2 ring-[#6247a8]" : ""}`}><button onClick={() => onSelect(item)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"><span className="h-8 w-8 shrink-0 rounded-[8px]" style={{ backgroundColor: item.color }} /><span className="min-w-0"><span className="block text-[12px] font-bold text-[#202025]">{item.name}</span><span className="mt-0.5 block text-[9px] leading-3 text-[#555]">{item.dimensions} <span className="mx-1">•</span>{item.color}</span></span></button><button aria-label={`Modifier ${item.name}`} onClick={() => openEdit(item)} className="p-1.5 text-[#555]"><Pencil className="h-4 w-4" /></button><button aria-label={`Supprimer ${item.name}`} disabled={isBuiltIn(item)} onClick={() => remove(item)} className={`p-1.5 ${isBuiltIn(item) ? "text-[#cfd5d8]" : "text-[#777]"}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></section>)}
    </div>
    <Button onClick={() => setShowFamilyPicker(true)} className="fixed bottom-24 right-5 z-[95] rounded-[20px] bg-[#e6d4ff] px-5 py-5 text-[13px] font-semibold text-[#51358b]"><Plus className="mr-1.5 h-4 w-4" />Nouveau modèle</Button>
    {(showFamilyPicker || creatingFamily || editing) && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-3 pb-20"><div className="w-full max-w-[430px] rounded-t-[20px] bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-bold">{creatingFamily ? `Nouveau modèle — ${creatingFamily}` : "Choisir une famille"}</h3><button onClick={closeEditor} className="p-1"><X className="h-4 w-4" /></button></div>{showFamilyPicker && !creatingFamily && !editing && <div className="grid grid-cols-2 gap-2">{families.map(family => <button key={family} onClick={() => openCreate(family)} className="rounded-lg bg-[#f1ecff] p-3 text-left text-[11px] font-semibold text-[#51358b]">{family}</button>)}</div>}{draft && (creatingFamily || editing) && <div className="space-y-2.5"><Label className="text-[10px]">Nom / section<Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className="mt-1 h-9 text-[11px]" /></Label>{draft.family === "Semelle" ? <div className="rounded-xl border border-[#eadff8] bg-[#fbf9ff] p-2.5"><div className="mb-2 text-[10px] font-bold text-[#51358b]">Section de la semelle — unités en mètre (m)</div><div className="grid grid-cols-3 gap-2"><Label className="text-[10px]">B (m)<Input type="number" inputMode="decimal" min="0.01" step="0.01" value={dimensionValues(draft.dimensions)[0] ?? "1.00"} onChange={event => updateFootingDimension(0, event.target.value)} className="mt-1 h-9 text-[11px]" /></Label><Label className="text-[10px]">L (m)<Input type="number" inputMode="decimal" min="0.01" step="0.01" value={dimensionValues(draft.dimensions)[1] ?? "1.00"} onChange={event => updateFootingDimension(1, event.target.value)} className="mt-1 h-9 text-[11px]" /></Label><Label className="text-[10px]">h (m)<Input type="number" inputMode="decimal" min="0.01" step="0.01" value={dimensionValues(draft.dimensions)[2] ?? "0.30"} onChange={event => updateFootingDimension(2, event.target.value)} className="mt-1 h-9 text-[11px]" /></Label></div><div className="mt-2 text-[9px] text-[#6c6c70]">Valeur enregistrée : {normalizedDimensions(draft)}</div></div> : <Label className="text-[10px]">Dimensions (m)<Input value={draft.dimensions} onChange={event => setDraft({ ...draft, dimensions: event.target.value })} className="mt-1 h-9 text-[11px]" /></Label>}<Label className="text-[10px]">Couleur<Input value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} className="mt-1 h-9 text-[11px]" /><span className="mt-2 flex flex-wrap gap-1.5">{MODEL_COLOR_PALETTE.map(color => <button type="button" key={color} aria-label={`Choisir ${color}`} onClick={() => setDraft({ ...draft, color })} className={`h-7 w-7 rounded-full border-2 ${draft.color.toLowerCase() === color ? "border-[#202025] ring-2 ring-[#d9c7ff]" : "border-white"}`} style={{ backgroundColor: color }} />)}</span></Label><div className="flex items-center gap-2 text-[10px] text-[#555]"><span className="h-6 w-6 rounded" style={{ backgroundColor: draft.color }} />Aperçu de la couleur</div><Button onClick={save} className="w-full bg-[#6247a8] text-[11px] text-white"><Check className="mr-1.5 h-4 w-4" />Enregistrer et sélectionner</Button></div>}</div></div>}
  </div>;
}
