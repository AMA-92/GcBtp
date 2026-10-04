export function axisPosition(index: number, distance: number) {
  return Number((index * Math.max(distance, 0.1)).toFixed(2));
}

export function nextAxisLabel(axis: "x" | "y", length: number) {
  return axis === "x" ? String(length + 1) : String.fromCharCode(65 + length);
}

/** Insert an explicitly chosen label between two existing labels. */
export function insertAxisLabel(labels: string[], index: number, label: string) {
  return [...labels.slice(0, index + 1), label, ...labels.slice(index + 1)];
}

/** Removing an axis only removes its own label; all other names remain unchanged. */
export function removeAxisLabel(labels: string[], index: number) {
  return labels.length <= 2 ? labels : labels.filter((_, position) => position !== index);
}
