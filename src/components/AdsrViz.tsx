import type { Envelope } from '../engine/envelope';

interface Props {
  envelope: Envelope;
  color: string;
  onPlay: () => void;
  playDisabled: boolean;
  width?: number;
  height?: number;
}

/** Share of the width given to the sustain plateau, so its level is always readable. */
const HOLD = 0.22;
const PAD = 4;
const ENV_MAX = 2;

/** Small ADSR curve on a black screen, in the bank colour, with a play button to audition. */
export function AdsrViz({ envelope: { attack, decay, sustain, release }, color, onPlay, playDisabled, width = 92, height = 52 }: Props) {
  const w = width - PAD * 2;
  const h = height - PAD * 2 - 2;
  // Each timed segment gets up to a third of the non-hold width, on the same cube-root
  // scale as the knobs (0–2s), so the drawing matches the knob positions.
  const seg = (w * (1 - HOLD)) / 3;
  const width_ = (t: number) => seg * Math.cbrt(Math.min(t, ENV_MAX) / ENV_MAX);
  const xa = PAD + width_(attack);
  const xd = xa + width_(decay);
  const xs = xd + w * HOLD;
  const xr = xs + width_(release);
  const top = PAD + 1;
  const base = PAD + h + 1;
  const ys = base - sustain * h;
  const line = `M ${PAD} ${base} L ${xa} ${top} L ${xd} ${ys} L ${xs} ${ys} L ${xr} ${base}`;

  return (
    <div className="adsr" style={{ width, height }}>
      <svg width={width} height={height} aria-hidden>
        <path d={`${line} Z`} fill={color} fillOpacity={0.18} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
        {[
          [xa, top],
          [xd, ys],
          [xs, ys],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.75} fill={color} />
        ))}
      </svg>
      <button className="adsr__play" onClick={onPlay} disabled={playDisabled} aria-label="Play clip with envelope" title="Play clip with envelope">
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden>
          <path d="M1.5 1v6l5-3z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
