import { useRef, useState, type ReactNode } from 'react';
import { bankStyle } from '../types';
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
  const clampBpm = (v: number) => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));
  const setBpm = (v: number) => {
    if (!Number.isNaN(v)) p.onBpm(clampBpm(v));
  };

  // The BPM field edits a draft; it is clamped and applied on Enter or blur
  // (clamping per keystroke would turn "1" into 40 before you finish typing).
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);
  const cancelDraft = useRef(false);
  const commitBpm = () => {
    if (bpmDraft !== null && bpmDraft !== '') setBpm(parseInt(bpmDraft, 10));
    setBpmDraft(null);
  };

  return (
    <div className="seq">
      <div className="seq__transport">
        <IconButton label={p.playing ? 'Stop (space)' : 'Play (space)'} onClick={p.onPlayToggle} active={p.playing}>
          {p.playing ? <StopIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton
          label={p.bouncing ? `Stop and download (${p.bounceElapsed.toFixed(1)}s)` : 'Record output and download'}
          onClick={p.onBounceToggle}
          disabled={p.bounceBusy}
          className={`btn--rec${p.bouncing ? ' btn--rec-on' : ''}`}
        >
          <span className="rec-dot" />
        </IconButton>

        <div className="lcd">
          <span className="lcd__readout">
            <input
              type="text"
              inputMode="numeric"
              className="lcd__num"
              value={bpmDraft ?? String(p.bpm)}
              onFocus={(e) => {
                setBpmDraft(String(p.bpm));
                e.currentTarget.select();
              }}
              onChange={(e) => setBpmDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onBlur={() => {
                if (cancelDraft.current) {
                  cancelDraft.current = false;
                  setBpmDraft(null);
                } else commitBpm();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur(); // blur commits
                } else if (e.key === 'Escape') {
                  cancelDraft.current = true;
                  e.currentTarget.blur();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const base = parseInt(bpmDraft ?? '', 10) || p.bpm;
                  const next = clampBpm(base + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
                  p.onBpm(next);
                  setBpmDraft(String(next));
                }
              }}
              aria-label={`BPM (${BPM_MIN}–${BPM_MAX}, Enter to apply)`}
            />
            <span className="lcd__unit">bpm</span>
          </span>
          <input
            type="range"
            className="slider slider--lcd"
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
            style={bankStyle(b)}
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
