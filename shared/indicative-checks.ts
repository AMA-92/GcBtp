export type CheckStatus = "satisfaisant" | "à vérifier" | "non satisfaisant";
export type IndicativeCheck = { elementId: string; type: "dalle" | "poutre" | "poteau" | "semelle"; demand: number; capacity: number; utilization: number; status: CheckStatus; assumptions: string[] };

function status(utilization: number): CheckStatus { return utilization <= 0.8 ? "satisfaisant" : utilization <= 1 ? "à vérifier" : "non satisfaisant"; }
function safe(value: number | undefined, fallback = 0) { return Number.isFinite(value) && (value ?? 0) >= 0 ? value as number : fallback; }

export function checkBeam(input: { elementId: string; span: number; width: number; depth: number; uniformLoad: number; concreteStrength?: number }): IndicativeCheck {
  const span = safe(input.span);
  const width = safe(input.width);
  const depth = safe(input.depth);
  const load = safe(input.uniformLoad);
  const moment = load * span * span / 8;
  const capacity = Math.max(0.001, width * depth * depth * safe(input.concreteStrength, 25) * 1000 / 6);
  const utilization = moment / capacity;
  return { elementId: input.elementId, type: "poutre", demand: moment, capacity, utilization, status: status(utilization), assumptions: ["Poutre simplement appuyée", "Charge uniformément répartie", "Vérification indicative de flexion"] };
}

export function checkColumn(input: { elementId: string; axialLoad: number; width: number; depth: number; concreteStrength?: number }): IndicativeCheck {
  const area = safe(input.width) * safe(input.depth);
  const capacity = Math.max(0.001, area * safe(input.concreteStrength, 25) * 1000 * 0.35);
  const utilization = safe(input.axialLoad) / capacity;
  return { elementId: input.elementId, type: "poteau", demand: safe(input.axialLoad), capacity, utilization, status: status(utilization), assumptions: ["Compression centrée", "Coefficient indicatif 0,35·fck", "Élancement et moments non inclus"] };
}

export function checkSlab(input: { elementId: string; span: number; thickness: number; uniformLoad: number; concreteStrength?: number }): IndicativeCheck {
  const span = safe(input.span);
  const thickness = safe(input.thickness);
  const demand = safe(input.uniformLoad) * span * span / 8;
  const capacity = Math.max(0.001, thickness * thickness * safe(input.concreteStrength, 25) * 1000 / 12);
  const utilization = demand / capacity;
  return { elementId: input.elementId, type: "dalle", demand, capacity, utilization, status: status(utilization), assumptions: ["Bande unitaire de dalle", "Portée simplifiée", "Ferraillage réel à vérifier"] };
}

export function summarizeChecks(checks: IndicativeCheck[]) {
  return { checks, warnings: checks.filter(check => check.status !== "satisfaisant").map(check => `${check.type} ${check.elementId} : ${check.status} (${(check.utilization * 100).toFixed(0)} %)`) };
}
