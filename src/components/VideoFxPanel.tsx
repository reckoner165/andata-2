import type { ReactNode } from 'react';
import { ContextMenu, Tabs } from 'radix-ui';
import type { Orientation } from '../engine/Engine';
import { duotoneFilterId, type DuotoneFx } from '../engine/fx';
import { BANK_COLORS, bankStyle, type BankUI } from '../types';
import { Knob } from './Knob';

interface Props {
  banks: BankUI[];
  orientation: Orientation;
  onChange: (bank: number, fx: DuotoneFx) => void;
  onCopyToAll: (bank: number) => void;
}

const fmtPct = (v: number) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`);

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
                {b.fx.amount > 0 && <span className="fx__dot" aria-label="effect on" />}
              </Tabs.Trigger>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="menu">
                <ContextMenu.Label className="menu__label">bank {i + 1} two-tone</ContextMenu.Label>
                <ContextMenu.Item className="menu__item" onSelect={() => onCopyToAll(i)}>
                  Copy to all banks
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        ))}
      </Tabs.List>

      {banks.map((b, i) => {
        const fx = b.fx;
        const set = (patch: Partial<DuotoneFx>) => onChange(i, { ...fx, ...patch });
        const color = BANK_COLORS[i];
        return (
          <Tabs.Content key={i} value={String(i)} className="fx__body" style={bankStyle(i)}>
            <div className="fx__title">
              <span>effects</span>
              <span className="field__label">bank {i + 1}</span>
            </div>

            <div className="fx__row">
              <div className={`fx__preview fx__preview--${orientation}`}>
                {b.thumbUrl ? (
                  <img src={b.thumbUrl} alt="" style={{ filter: fx.amount > 0 ? `url(#${duotoneFilterId(i)})` : undefined }} />
                ) : (
                  <span className="fx__empty">empty</span>
                )}
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
              </div>
            </div>

            <p className="fx__hint">right-click a bank tab to copy its effects to all banks</p>
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
}
