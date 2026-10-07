import type { ReactNode } from 'react';
import { BANK_COLORS } from '../types';
import { ClearIcon, IconButton, PlayIcon, RandomIcon, StopIcon } from './IconButton';

interface Props {
  grid: boolean[][];
  step: number;
  playing: boolean;
  bpm: number;
  bouncing: boolean;
  bounceElapsed: number;
  bounceBusy: boolean;
  hasClip: boolean[];
  onToggleCell: (bank: number, step: number) => void;
  onPlayToggle: () => void;
  onBpm: (bpm: number) => void;
  onRandomize: () => void;
  onClear: () => void;
  onBounceToggle: () => void;
  /** Rendered at the right of the transport, before the output recorder. */
  master: ReactNode;
}

/** Steps are laid out in four groups of four. */
const GROUPS = [0, 1, 2, 3];

export const BPM_MIN = 40;
export const BPM_MAX = 240;

export function SequencerPanel(p: Props) {
  const setBpm = (v: number) => {
    if (!Number.isNaN(v)) p.onBpm(Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v))));
  };

  return (
    <div className="seq">
      <div className="seq__transport">
        <IconButton label={p.playing ? 'Stop (space)' : 'Play (space)'} onClick={p.onPlayToggle} active={p.playing}>
          {p.playing ? <StopIcon /> : <PlayIcon />}
        </IconButton>

        <div className="bpm">
          <div className="lcd">
            <input
              type="number"
              className="lcd__num"
              min={BPM_MIN}
              max={BPM_MAX}
              value={p.bpm}
              onChange={(e) => setBpm(e.target.valueAsNumber)}
              aria-label="BPM"
            />
            <span className="lcd__unit">bpm</span>
          </div>
          <input
            type="range"
            className="slider"
            min={BPM_MIN}
            max={BPM_MAX}
            value={p.bpm}
            onChange={(e) => setBpm(e.target.valueAsNumber)}
            aria-label="BPM slider"
          />
        </div>

        <IconButton label="Randomize pattern" onClick={p.onRandomize}>
          <RandomIcon />
        </IconButton>
        <IconButton label="Clear pattern" onClick={p.onClear}>
          <ClearIcon />
        </IconButton>

        {p.master}

        <button
          className={`btn btn--rec${p.bouncing ? ' btn--rec-on' : ''}`}
          onClick={p.onBounceToggle}
          disabled={p.bounceBusy}
          title="Record the composed output; stopping downloads an MP4"
        >
          <span className="rec-dot" />
          {p.bounceBusy ? 'bouncing' : p.bouncing ? `save ${p.bounceElapsed.toFixed(1)}s` : 'rec output'}
        </button>
      </div>

      <div className="seq__grid">
        <div className="seq__row seq__row--header" aria-hidden>
          <span />
          {GROUPS.map((g) => (
            <div key={g} className="seq__group">
              {[0, 1, 2, 3].map((k) => {
                const s = g * 4 + k;
                return (
                  <span key={k} className={`seq__num${s === p.step ? ' seq__num--head' : ''}`}>
                    {String(s + 1).padStart(2, '0')}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {p.grid.map((row, b) => (
          <div
            key={b}
            className={`seq__row${p.hasClip[b] ? '' : ' seq__row--empty'}`}
            style={{ '--bank': BANK_COLORS[b] } as React.CSSProperties}
          >
            <span className="seq__rowlabel">{b + 1}</span>
            {GROUPS.map((g) => (
              <div key={g} className="seq__group">
                {row.slice(g * 4, g * 4 + 4).map((on, k) => {
                  const s = g * 4 + k;
                  return (
                    <button
                      key={s}
                      className={`pad${on ? ' pad--on' : ''}${s === p.step ? ' pad--head' : ''}`}
                      aria-pressed={on}
                      aria-label={`Bank ${b + 1} step ${s + 1}`}
                      onClick={() => p.onToggleCell(b, s)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
