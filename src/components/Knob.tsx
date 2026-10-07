import { useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  color?: string;
  size?: number;
  disabled?: boolean;
  /** Draw the value arc from 12 o'clock (for centred controls like pan). */
  bipolar?: boolean;
}

const SWEEP = 270;
const START = -135;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** OP-1 style encoder: drag vertically (Shift = fine), scroll, arrow keys; double-click resets. */
export function Knob({
  label,
  value,
  min,
  max,
  defaultValue,
  onChange,
  format = (v) => v.toFixed(2),
  color = '#141414',
  size = 40,
  disabled,
  bipolar,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number } | null>(null);
  const range = max - min || 1;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const norm = (clamp(value) - min) / range;
  const angle = START + norm * SWEEP;
  const origin = bipolar ? START + SWEEP / 2 : START;

  // Keep the latest props for the native (non-passive) wheel listener.
  const latest = useRef({ value, onChange, clamp, range, disabled });
  latest.current = { value, onChange, clamp, range, disabled };

  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      const l = latest.current;
      if (l.disabled) return;
      e.preventDefault();
      l.onChange(l.clamp(l.value - (Math.sign(e.deltaY) * l.range) / (e.shiftKey ? 400 : 80)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const c = size / 2;
  const ringR = c - 2;
  const capR = c - 7;
  const [x0, y0] = polar(c, c, capR * 0.25, angle);
  const [x1, y1] = polar(c, c, capR - 2, angle);

  return (
    <div className={`knob${disabled ? ' knob--disabled' : ''}`}>
      <div
        ref={ref}
        className="knob__dial"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dy = drag.current.y - e.clientY;
          onChange(clamp(drag.current.v + (dy / 160) * range * (e.shiftKey ? 0.1 : 1)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => !disabled && onChange(defaultValue)}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = range / (e.shiftKey ? 200 : 50);
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step));
          else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step));
          else return;
          e.preventDefault();
        }}
      >
        <svg width={size} height={size}>
          <path d={arc(c, c, ringR, START, START + SWEEP)} className="knob__track" />
          {Math.abs(angle - origin) > 0.5 && (
            <path d={arc(c, c, ringR, Math.min(origin, angle), Math.max(origin, angle))} className="knob__value" />
          )}
          <circle cx={c} cy={c} r={capR} fill={disabled ? undefined : color} className="knob__cap" />
          <line x1={x0} y1={y0} x2={x1} y2={y1} className="knob__notch" />
        </svg>
      </div>
      <div className="knob__label">{label}</div>
      <div className="knob__readout">{format(value)}</div>
    </div>
  );
}
