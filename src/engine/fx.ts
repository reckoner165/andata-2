/** Two-tone (duotone) video effect: luminance mapped from `shadow` to `highlight`, mixed in by `amount`. */
export interface DuotoneFx {
  /** 0 = off (original picture), 1 = full two-tone. */
  amount: number;
  shadow: string;
  highlight: string;
}

export const defaultFx = (highlight: string): DuotoneFx => ({ amount: 0, shadow: '#141414', highlight });

/** id of the SVG filter that renders bank `i`'s effect (see FxFilters). */
export const duotoneFilterId = (i: number) => `andata-duotone-${i}`;

/** '#rrggbb' → [r, g, b] in 0…1. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
