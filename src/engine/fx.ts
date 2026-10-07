import { coverSource, drawCover, type Rect } from './layout';

/** Two-tone (duotone) video effect: luminance mapped from `shadow` to `highlight`, mixed in by `amount`. */
export interface DuotoneFx {
  /** 0 = off (original picture), 1 = full two-tone. */
  amount: number;
  shadow: string;
  highlight: string;
}

/** Crush: pixelation (block size in stage pixels, per axis) and colour bit depth per channel. */
export interface CrushFx {
  x: number;
  y: number;
  bits: number;
}

export const CRUSH_MAX_BLOCK = 64;
export const MIN_BITS = 2;
export const MAX_BITS = 8;

export const defaultFx = (highlight: string): DuotoneFx => ({ amount: 0, shadow: '#141414', highlight });
export const DEFAULT_CRUSH: CrushFx = { x: 1, y: 1, bits: MAX_BITS };

/** Block sizes are stored unrounded (so knobs can creep); they render as whole pixels. */
export const blockPx = (v: number) => Math.max(1, Math.round(v));
export const crushActive = (c: CrushFx) => blockPx(c.x) > 1 || blockPx(c.y) > 1 || c.bits < MAX_BITS;
/** Whether the bank's SVG colour filter (two-tone and/or bit depth) needs applying. */
export const colorFxActive = (fx: DuotoneFx, c: CrushFx) => fx.amount > 0 || c.bits < MAX_BITS;
export const anyFxActive = (fx: DuotoneFx, c: CrushFx) => fx.amount > 0 || crushActive(c);

/** id of the SVG filter that renders bank `i`'s colour effects (see FxFilters). */
export const fxFilterId = (i: number) => `andata-fx-${i}`;

/** '#rrggbb' → [r, g, b] in 0…1. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** feFuncX discrete table for `bits` per channel: 2^bits evenly spaced levels. */
export function posterizeTable(bits: number) {
  const n = 2 ** bits;
  return Array.from({ length: n }, (_, k) => +(k / (n - 1)).toFixed(4)).join(' ');
}

/**
 * Draws `img` cover-fitted into `rect` with a bank's effects. Pixelation: draw small onto
 * `scratch` (smoothed, so each block is an average), then scale up with smoothing off.
 * Colour (two-tone, bit depth): the bank's SVG filter on the final draw.
 * `blockScale` converts stage-pixel block sizes for smaller targets (the fx preview).
 */
export function drawWithFx(
  g: CanvasRenderingContext2D,
  img: CanvasImageSource,
  rect: Rect,
  bank: number,
  fx: DuotoneFx,
  crush: CrushFx,
  scratch: HTMLCanvasElement,
  blockScale = 1,
) {
  if (colorFxActive(fx, crush)) g.filter = `url(#${fxFilterId(bank)})`;
  const bx = blockPx(crush.x) * blockScale;
  const by = blockPx(crush.y) * blockScale;
  if (bx > 1 || by > 1) {
    const [x, y, w, h] = rect;
    const sw = Math.max(1, Math.round(w / Math.max(1, bx)));
    const sh = Math.max(1, Math.round(h / Math.max(1, by)));
    if (scratch.width !== sw) scratch.width = sw;
    if (scratch.height !== sh) scratch.height = sh;
    const src = coverSource(img, w, h);
    if (!src) return void (g.filter = 'none');
    const sg = scratch.getContext('2d')!;
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = 'medium';
    // Squash the region the tile would show (not a re-fitted crop) into sw×sh, so the
    // picture stays in place and blocks form only along the crushed axis.
    sg.clearRect(0, 0, sw, sh);
    sg.drawImage(img, ...src, 0, 0, sw, sh);
    const smooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(scratch, 0, 0, sw, sh, x, y, w, h);
    g.imageSmoothingEnabled = smooth;
  } else {
    drawCover(g, img, rect);
  }
  g.filter = 'none';
}
