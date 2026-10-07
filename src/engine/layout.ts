export type Rect = [x: number, y: number, w: number, h: number];

const GAP = 4;

/**
 * 1 = full, 2 = side-by-side (stacked on a portrait stage, where side-by-side
 * would give thin slivers), 3 = two on top + one wide bottom, 4 = 2×2.
 */
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
      return H > W
        ? [
            [0, 0, W, hh - g],
            [0, hh + g, W, hh - g],
          ]
        : [
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
/** The centred source region of `img` that cover-fits a w×h box, or null if the image has no size. */
export function coverSource(img: CanvasImageSource, w: number, h: number): Rect | null {
  const sw = (img as { width: number }).width;
  const sh = (img as { height: number }).height;
  if (!sw || !sh) return null;
  const scale = Math.max(w / sw, h / sh);
  const cw = w / scale;
  const ch = h / scale;
  return [(sw - cw) / 2, (sh - ch) / 2, cw, ch];
}

export function drawCover(g: CanvasRenderingContext2D, img: CanvasImageSource, [x, y, w, h]: Rect) {
  const src = coverSource(img, w, h);
  if (src) g.drawImage(img, ...src, x, y, w, h);
}
