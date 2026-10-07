import { useEffect, useRef } from 'react';

interface Props {
  volume: number;
  onVolume: (v: number) => void;
  powered: boolean;
  /** Returns the current post-fader peak per channel (linear). */
  readPeaks: () => [number, number];
}

const SEGMENTS = 28;
const FLOOR_DB = -48;
const FALL_DB_PER_S = 28;
const HOLD_S = 1;
const W = 168;
const H = 18;

const toDb = (lin: number) => (lin > 0 ? 20 * Math.log10(lin) : -Infinity);
const fmtDb = (g: number) => (g <= 0.0001 ? '-∞db' : `${(20 * Math.log10(g)).toFixed(1)}db`);

/** dB → number of lit segments. */
const segs = (db: number) => Math.max(0, Math.min(SEGMENTS, Math.round(((db - FLOOR_DB) / -FLOOR_DB) * SEGMENTS)));

function segColor(i: number, css: CSSStyleDeclaration) {
  const db = FLOOR_DB + ((i + 1) / SEGMENTS) * -FLOOR_DB;
  if (db > -1) return css.getPropertyValue('--rec');
  if (db > -9) return css.getPropertyValue('--accent');
  return css.getPropertyValue('--ink');
}

/** Master volume slider with a segmented, horizontal stereo peak meter. */
export function MasterSection({ volume, onVolume, powered, readPeaks }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readRef = useRef(readPeaks);
  readRef.current = readPeaks;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const g = canvas.getContext('2d')!;
    g.scale(dpr, dpr);
    const css = getComputedStyle(canvas);
    const off = css.getPropertyValue('--line');
    const segW = (W - (SEGMENTS - 1) * 2) / SEGMENTS;
    const rowH = (H - 2) / 2;

    const level = [FLOOR_DB, FLOOR_DB];
    const peak = [FLOOR_DB, FLOOR_DB];
    const peakAt = [0, 0];
    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const peaks = powered ? readRef.current() : [0, 0];
      g.clearRect(0, 0, W, H);
      for (let ch = 0; ch < 2; ch++) {
        const db = Math.max(FLOOR_DB, toDb(peaks[ch]));
        level[ch] = Math.max(db, level[ch] - FALL_DB_PER_S * dt);
        if (db >= peak[ch]) {
          peak[ch] = db;
          peakAt[ch] = now;
        } else if (now - peakAt[ch] > HOLD_S * 1000) {
          peak[ch] = Math.max(FLOOR_DB, peak[ch] - FALL_DB_PER_S * dt);
        }
        const lit = segs(level[ch]);
        const hold = segs(peak[ch]) - 1;
        const y = ch * (rowH + 2);
        for (let i = 0; i < SEGMENTS; i++) {
          g.fillStyle = i < lit || (i === hold && hold > 0) ? segColor(i, css) : off;
          g.fillRect(i * (segW + 2), y, segW, rowH);
        }
      }
      if (powered) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [powered]);

  return (
    <div className="master">
      <span className="field__label">master</span>
      <div className="master__meter" aria-hidden>
        <span className="master__ch">L</span>
        <span className="master__ch">R</span>
        <canvas ref={canvasRef} style={{ width: W, height: H }} />
      </div>
      <input
        type="range"
        className="slider"
        min={0}
        max={2}
        step={0.01}
        value={volume}
        onChange={(e) => onVolume(e.target.valueAsNumber)}
        onDoubleClick={() => onVolume(1)}
        aria-label="Master volume"
        title="Master volume (double-click to reset)"
      />
      <span className="master__readout">{fmtDb(volume)}</span>
    </div>
  );
}
