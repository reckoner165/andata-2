import { duotoneFilterId, hexToRgb, type DuotoneFx } from '../engine/fx';

/**
 * Hidden SVG filters, one per bank. The compositor draws each tile with
 * `ctx.filter = url(#…)`, so the effect lands on the stage and in the bounce.
 * (Kept rendered at 0×0 rather than display:none, which would disable the filters.)
 */
export function FxFilters({ fx }: { fx: DuotoneFx[] }) {
  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden>
      {fx.map((f, i) => {
        const [sr, sg, sb] = hexToRgb(f.shadow);
        const [hr, hg, hb] = hexToRgb(f.highlight);
        return (
          <filter key={i} id={duotoneFilterId(i)} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            {/* luminance → gradient map shadow…highlight */}
            <feColorMatrix type="saturate" values="0" result="grey" />
            <feComponentTransfer in="grey" result="duo">
              <feFuncR type="table" tableValues={`${sr} ${hr}`} />
              <feFuncG type="table" tableValues={`${sg} ${hg}`} />
              <feFuncB type="table" tableValues={`${sb} ${hb}`} />
            </feComponentTransfer>
            {/* mix with the original picture by `amount` */}
            <feComposite in="duo" in2="SourceGraphic" operator="arithmetic" k1="0" k2={f.amount} k3={1 - f.amount} k4="0" />
          </filter>
        );
      })}
    </svg>
  );
}
