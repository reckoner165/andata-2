import { fxFilterId, hexToRgb, MAX_BITS, posterizeTable, type CrushFx, type DuotoneFx } from '../engine/fx';

/**
 * Hidden SVG filters, one per bank, holding its colour effects: two-tone, then bit depth.
 * The compositor (and the fx preview) draw with `ctx.filter = url(#…)`, so the effect lands
 * on the stage and in the bounce. Kept rendered at 0×0, since display:none disables filters.
 */
export function FxFilters({ effects }: { effects: { fx: DuotoneFx; crush: CrushFx }[] }) {
  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden>
      {effects.map(({ fx, crush }, i) => {
        const duo = fx.amount > 0;
        const post = crush.bits < MAX_BITS;
        const [sr, sg, sb] = hexToRgb(fx.shadow);
        const [hr, hg, hb] = hexToRgb(fx.highlight);
        const levels = posterizeTable(crush.bits);
        return (
          <filter key={i} id={fxFilterId(i)} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            {duo && (
              <>
                {/* two-tone: luminance → gradient map shadow…highlight, mixed by amount */}
                <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="grey" />
                <feComponentTransfer in="grey" result="duo">
                  <feFuncR type="table" tableValues={`${sr} ${hr}`} />
                  <feFuncG type="table" tableValues={`${sg} ${hg}`} />
                  <feFuncB type="table" tableValues={`${sb} ${hb}`} />
                </feComponentTransfer>
                <feComposite in="duo" in2="SourceGraphic" operator="arithmetic" k1="0" k2={fx.amount} k3={1 - fx.amount} k4="0" result="tone" />
              </>
            )}
            {post && (
              /* crush: quantise each channel to 2^bits levels */
              <feComponentTransfer in={duo ? 'tone' : 'SourceGraphic'}>
                <feFuncR type="discrete" tableValues={levels} />
                <feFuncG type="discrete" tableValues={levels} />
                <feFuncB type="discrete" tableValues={levels} />
              </feComponentTransfer>
            )}
            {!duo && !post && <feOffset in="SourceGraphic" dx="0" dy="0" />}
          </filter>
        );
      })}
    </svg>
  );
}
