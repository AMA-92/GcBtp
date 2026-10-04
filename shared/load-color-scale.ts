export type LoadScaleRow = { id: string; levelId: string; type: string; nu: number };

export type LoadScale = {
  minimum: number;
  maximum: number;
  colorFor: (row: LoadScaleRow) => string;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const channel = (from: number, to: number, ratio: number) =>
  Math.round(from + (to - from) * ratio);

export function createLoadScale(rows: LoadScaleRow[]): LoadScale {
  const values = rows.map(row => Number(row.nu)).filter(Number.isFinite);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  return {
    minimum,
    maximum,
    colorFor: row => {
      if (!Number.isFinite(row.nu)) return "#d7e2e7";
      const ratio = maximum > minimum ? clamp((row.nu - minimum) / (maximum - minimum), 0, 1) : 1;
      const red = 255;
      const green = channel(236, 23, ratio);
      const blue = channel(180, 23, ratio);
      return `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`;
    },
  };
}
