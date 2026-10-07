import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ContextMenu, Tabs } from 'radix-ui';
import { STAGE_SIZE, type Orientation } from '../engine/Engine';
import {
  anyFxActive,
  blockPx,
  CRUSH_MAX_BLOCK,
  drawWithFx,
  MAX_BITS,
  MIN_BITS,
  type CrushFx,
  type DuotoneFx,
} from '../engine/fx';
import { BANK_COLORS, bankStyle, type BankUI } from '../types';
import { Knob } from './Knob';

interface Props {
  banks: BankUI[];
  orientation: Orientation;
  onChange: (bank: number, patch: { fx?: DuotoneFx; crush?: CrushFx }) => void;
  onCopyToAll: (bank: number) => void;
}

const fmtPct = (v: number) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`);

// Pixel block size 1…64 on a squared knob curve, so small blocks get most of the travel.
const blockToKnob = (px: number) => Math.sqrt((px - 1) / (CRUSH_MAX_BLOCK - 1));
const knobToBlock = (v: number) => 1 + (CRUSH_MAX_BLOCK - 1) * v * v;
const fmtBlock = (v: number) => {
  const px = blockPx(knobToBlock(v));
  return px === 1 ? 'off' : `${px}px`;
};
const fmtBits = (v: number) => `${Math.round(v)}-bit`;

/** The bank's thumbnail drawn through the same effect pipeline as the stage. */
function FxPreview({ src, bank, fx, crush, orientation }: { src: string | null; bank: number; fx: DuotoneFx; crush: CrushFx; orientation: Orientation }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return setImg(null);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = src;
  }, [src]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    // block sizes are in stage pixels; scale them to this small canvas
    const scale = c.width / STAGE_SIZE[orientation][0];
    drawWithFx(g, img, [0, 0, c.width, c.height], bank, fx, crush, (scratch.current ??= document.createElement('canvas')), scale);
  }, [img, bank, fx, crush, orientation]);

  return src ? <canvas ref={canvasRef} className="fx__canvas" /> : <span className="fx__empty">empty</span>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <label className="fxcolor" title={`${label}: ${value}`}>
      <span className="field__label">{label}</span>
      <span className="fxcolor__swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="fxcolor__hex">{value}</span>
    </label>
  );
}

/** One effect: its name, then its controls right-aligned beneath. */
function FxSection({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="fxsec">
      <h4 className="fxsec__name">{name}</h4>
      <div className="fxsec__controls">{children}</div>
    </section>
  );
}

/** Per-bank video effects. Right-click a bank tab to copy its effect to every bank. */
export function VideoFxPanel({ banks, orientation, onChange, onCopyToAll }: Props) {
  return (
    <Tabs.Root className="fx" defaultValue="0">
      <Tabs.List className="fx__tabs" aria-label="Bank">
        {banks.map((b, i) => (
          <ContextMenu.Root key={i}>
            <ContextMenu.Trigger asChild>
              <Tabs.Trigger
                value={String(i)}
                className="fx__tab"
                style={bankStyle(i)}
                title="Right-click: copy to all banks"
              >
                bank {i + 1}
                {anyFxActive(b.fx, b.crush) && <span className="fx__dot" aria-label="effects on" />}
              </Tabs.Trigger>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="menu">
                <ContextMenu.Label className="menu__label">bank {i + 1} effects</ContextMenu.Label>
                <ContextMenu.Item className="menu__item" onSelect={() => onCopyToAll(i)}>
                  Copy to all banks
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        ))}
      </Tabs.List>

      {banks.map((b, i) => {
        const { fx, crush } = b;
        const set = (patch: Partial<DuotoneFx>) => onChange(i, { fx: { ...fx, ...patch } });
        const setCrush = (patch: Partial<CrushFx>) => onChange(i, { crush: { ...crush, ...patch } });
        const color = BANK_COLORS[i];
        return (
          <Tabs.Content key={i} value={String(i)} className="fx__body" style={bankStyle(i)}>
            <div className="fx__title">
              <span>effects</span>
              <span className="field__label">bank {i + 1}</span>
            </div>

            <div className="fx__row">
              <div className={`fx__preview fx__preview--${orientation}`}>
                <FxPreview src={b.thumbUrl} bank={i} fx={fx} crush={crush} orientation={orientation} />
              </div>

              {/* one FxSection per effect; future effects stack here */}
              <div className="fx__list">
                <FxSection name="two-tone">
                  <div className="fx__colorgroup">
                    <div className="fx__colors">
                      <ColorField label="shadows" value={fx.shadow} onChange={(shadow) => set({ shadow })} />
                      <ColorField label="highlights" value={fx.highlight} onChange={(highlight) => set({ highlight })} />
                    </div>
                    <div className="fx__ramp" style={{ background: `linear-gradient(90deg, ${fx.shadow}, ${fx.highlight})` }} />
                  </div>
                  <Knob
                    size={44}
                    label="blend"
                    value={fx.amount}
                    min={0}
                    max={1}
                    defaultValue={0}
                    color={color}
                    format={fmtPct}
                    onChange={(amount) => set({ amount })}
                  />
                </FxSection>

                <FxSection name="crush">
                  <Knob
                    size={44}
                    label="x"
                    value={blockToKnob(crush.x)}
                    min={0}
                    max={1}
                    defaultValue={0}
                    color={color}
                    format={fmtBlock}
                    onChange={(v) => setCrush({ x: knobToBlock(v) })}
                  />
                  <Knob
                    size={44}
                    label="y"
                    value={blockToKnob(crush.y)}
                    min={0}
                    max={1}
                    defaultValue={0}
                    color={color}
                    format={fmtBlock}
                    onChange={(v) => setCrush({ y: knobToBlock(v) })}
                  />
                  <Knob
                    size={44}
                    label="depth"
                    value={crush.bits}
                    min={MIN_BITS}
                    max={MAX_BITS}
                    defaultValue={MAX_BITS}
                    step={1}
                    color={color}
                    format={fmtBits}
                    onChange={(bits) => setCrush({ bits })}
                  />
                </FxSection>
              </div>
            </div>

            <p className="fx__hint">right-click a bank tab to copy its effects to all banks</p>
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
}
