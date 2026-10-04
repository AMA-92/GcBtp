export const FOOTING_2D_SIZE = 34;
export const FOOTING_3D_HALF_X = 0.28;
export const FOOTING_3D_HALF_Y = 0.22;
export const FOOTING_3D_HEIGHT = 0.18;

export function footing2DBox(center: number) {
  return { start: center - FOOTING_2D_SIZE / 2, size: FOOTING_2D_SIZE };
}
