export type Rect = [x: number, y: number, w: number, h: number];

const GAP = 4;

/** 1 = full, 2 = side-by-side, 3 = two on top + one wide bottom, 4 = 2×2. */
export function tileRects(count: number, W: number, H: number): Rect[] {
  const g = GAP / 2;
  const hw = W / 2;
  const hh = H / 2;
  switch (count) {
    case 0:
      return [];
    case 1:
      return [[0, 0, W, H]];
    case 2:
      return [
        [0, 0, hw - g, H],
        [hw + g, 0, hw - g, H],
      ];
    case 3:
      return [
        [0, 0, hw - g, hh - g],
        [hw + g, 0, hw - g, hh - g],
        [0, hh + g, W, hh - g],
      ];
    default:
      return [
        [0, 0, hw - g, hh - g],
        [hw + g, 0, hw - g, hh - g],
        [0, hh + g, hw - g, hh - g],
        [hw + g, hh + g, hw - g, hh - g],
      ];
  }
}

/** Draws `img` scaled to cover `rect`, cropping the overflow. */
export function drawCover(g: CanvasRenderingContext2D, img: CanvasImageSource, [x, y, w, h]: Rect) {
  const sw = (img as { width: number }).width;
  const sh = (img as { height: number }).height;
  if (!sw || !sh) return;
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  g.drawImage(img, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
}
