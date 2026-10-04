export const MODEL_COLOR_PALETTE = [
  "#27358f", "#604239", "#ed5b00", "#2f8735", "#7620a8", "#0e8d96", "#d92b2b", "#d6a300", "#1976a8", "#c03a78", "#4f6f52", "#7b4b94",
] as const;

export function nextModelColor(index: number) { return MODEL_COLOR_PALETTE[index % MODEL_COLOR_PALETTE.length]; }
export function normalizeModelColor(color: string, fallback: string = MODEL_COLOR_PALETTE[0]) { return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback; }
