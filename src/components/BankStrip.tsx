import { BANK_COLORS, fmtTime, type BankUI } from '../types';
import { Knob } from './Knob';

const MIN_LEN = 0.05;

interface Props {
  index: number;
  bank: BankUI;
  recording: boolean;
  onChange: (patch: Partial<BankUI>) => void;
  onAudition: () => void;
  onClear: () => void;
}

// Uppercase on purpose: in VG5000 a lowercase l reads as 1.
const fmtPan = (v: number) => (v === 0 ? 'C' : `${v < 0 ? 'L' : 'R'}${Math.round(Math.abs(v) * 100)}`);
// Snap to centre near the middle so it is easy to recentre by hand.
const snapPan = (v: number) => (Math.abs(v) < 0.04 ? 0 : v);

const fmtDb = (g: number) => (g <= 0.0001 ? '-∞db' : `${(20 * Math.log10(g)).toFixed(1)}db`);

export function BankStrip({ index, bank, recording, onChange, onAudition, onClear }: Props) {
  const color = BANK_COLORS[index];
  const empty = !bank.hasClip;
  const len = bank.trimEnd - bank.trimStart;

  return (
    <div className={`bank${recording ? ' bank--rec' : ''}`} style={{ '--bank': color } as React.CSSProperties}>
      <div className="bank__head">
        <button
          className="bank__thumb"
          onClick={onAudition}
          disabled={empty}
          title="Audition (plays the trimmed clip once)"
        >
          {bank.thumbUrl ? <img src={bank.thumbUrl} alt="" /> : null}
          <span className="bank__num">{index + 1}</span>
          <span className="bank__thumbtext">
            {recording ? 'rec' : bank.loading ? 'loading' : empty ? 'empty' : '▶'}
          </span>
        </button>
        <div className="bank__meta">
          <div>{empty ? '—' : fmtTime(bank.duration)}</div>
          <div className="bank__len">{empty ? '' : `↔ ${fmtTime(len)}`}</div>
        </div>
      </div>

      <div className="bank__knobs">
        <Knob
          size={40}
          label="start"
          value={bank.trimStart}
          min={0}
          max={Math.max(bank.duration, 0.01)}
          defaultValue={0}
          color={color}
          disabled={empty}
          format={fmtTime}
          onChange={(v) => onChange({ trimStart: Math.min(v, bank.trimEnd - MIN_LEN) })}
        />
        <Knob
          size={40}
          label="end"
          value={bank.trimEnd}
          min={0}
          max={Math.max(bank.duration, 0.01)}
          defaultValue={bank.duration}
          color={color}
          disabled={empty}
          format={fmtTime}
          onChange={(v) => onChange({ trimEnd: Math.max(v, bank.trimStart + MIN_LEN) })}
        />
        <Knob
          size={40}
          label="gain"
          value={bank.gain}
          min={0}
          max={2}
          defaultValue={1}
          color={color}
          format={fmtDb}
          onChange={(gain) => onChange({ gain })}
        />
        <Knob
          size={40}
          label="pan"
          value={bank.pan}
          min={-1}
          max={1}
          defaultValue={0}
          color={color}
          bipolar
          format={fmtPan}
          onChange={(v) => onChange({ pan: snapPan(v) })}
        />
      </div>

      <div className="bank__actions">
        <button
          className={`toggle${bank.choke ? ' toggle--on' : ''}`}
          aria-pressed={bank.choke}
          onClick={() => onChange({ choke: !bank.choke })}
          title="Choke: a retrigger cuts the previous playback. Off: playbacks overlap."
        >
          choke
        </button>
        <button className="btn btn--small" onClick={onClear} disabled={empty} title="Clear bank">
          ✕
        </button>
      </div>
    </div>
  );
}
