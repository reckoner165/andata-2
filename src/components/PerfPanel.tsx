import { useEffect, useState, type ReactNode } from 'react';
import type { Engine, PerfSnapshot } from '../engine/Engine';
import { BANK_COUNT } from '../engine/Engine';
import { bankStyle } from '../types';

const POLL_MS = 500;

type Level = 'ok' | 'warn' | 'bad';
const n1 = (v: number) => v.toFixed(1);
const n0 = (v: number) => Math.round(v).toString();
const mb = (v: number) => `${Math.round(v)}MB`;

function Row({ label, value, level = 'ok', hint }: { label: string; value: ReactNode; level?: Level; hint: string }) {
  return (
    <div className="perf__row" title={hint}>
      <span className="perf__label">{label}</span>
      <span className={`perf__value perf__value--${level}`}>{value}</span>
    </div>
  );
}

/** Compact live readout: the figures that change decisions, sized to fit without scrolling. */
export function PerfPanel({ engine }: { engine: Engine }) {
  const [s, setS] = useState<PerfSnapshot>(() => engine.perfSnapshot());
  useEffect(() => {
    const id = setInterval(() => setS(engine.perfSnapshot()), POLL_MS);
    return () => clearInterval(id);
  }, [engine]);

  const w = s.window;
  const g = w?.global;
  const status = !s.powered ? 'power off' : !g ? 'measuring…' : `${s.playing ? 'playing' : 'stopped'}${s.bouncing ? ' · recording' : ''}`;
  const dash = '—';

  const bankRows: { label: string; hint: string; cell: (i: number) => [ReactNode, Level?] }[] = [
    { label: 'trig/s', hint: 'triggers per second', cell: (i) => [w ? n1(w.banks[i].triggersPerSec) : dash] },
    {
      label: 'decoders',
      hint: 'open video decoders (one per live playback)',
      cell: (i) => [s.banks[i].decoders, s.banks[i].decoders > 2 ? 'warn' : 'ok'],
    },
    { label: 'decoded/s', hint: 'frames decoded per second', cell: (i) => [w ? n0(w.banks[i].decodedPerSec) : dash] },
    { label: 'shown/s', hint: 'distinct frames shown per second', cell: (i) => [w ? n0(w.banks[i].shownPerSec) : dash] },
    {
      label: 'stalls/s',
      hint: 'frames needed before the decoder had one ready',
      cell: (i) => (w ? [n0(w.banks[i].stallsPerSec), w.banks[i].stallsPerSec > 0 ? 'warn' : 'ok'] : [dash]),
    },
    {
      label: 'start ms',
      hint: 'trigger → first decoded frame (avg)',
      cell: (i) => (w?.banks[i].startupMs.n ? [n0(w.banks[i].startupMs.avg), w.banks[i].startupMs.avg > 100 ? 'warn' : 'ok'] : [dash]),
    },
    {
      label: 'draw ms',
      hint: 'time to draw this tile incl. effects (avg)',
      cell: (i) => (w?.banks[i].drawMs.n ? [n1(w.banks[i].drawMs.avg), w.banks[i].drawMs.avg > 4 ? 'warn' : 'ok'] : [dash]),
    },
  ];

  return (
    <div className="perf">
      <div className="perf__status">
        <span>performance</span>
        <span className="field__label">{status}</span>
      </div>

      <div className="perf__global">
        <Row label="fps" hint="compositor frames per second" value={g ? n1(g.fps) : dash} level={g && g.fps < 50 ? 'warn' : 'ok'} />
        <Row
          label="headroom"
          hint="worst-case time between scheduling a step and it playing; near 0 means close to late"
          value={g?.headroomMs.n ? `${n0(g.headroomMs.min)}ms` : dash}
          level={g?.headroomMs.n ? (g.headroomMs.min < 0 ? 'bad' : g.headroomMs.min < 30 ? 'warn' : 'ok') : 'ok'}
        />
        <Row
          label="frame"
          hint="compositor work per frame, avg / 95th percentile"
          value={g ? `${n1(g.frameMs.avg)} / ${n1(g.frameMs.p95)}ms` : dash}
          level={g ? (g.frameMs.p95 > 16 ? 'bad' : g.frameMs.p95 > 8 ? 'warn' : 'ok') : 'ok'}
        />
        <Row label="late steps" hint="steps scheduled after their play time (last second)" value={g ? g.lateTriggers : dash} level={g && g.lateTriggers > 0 ? 'bad' : 'ok'} />
        <Row label="dropped/s" hint="frames missed per second" value={g ? n1(g.droppedPerSec) : dash} level={g && g.droppedPerSec > 0 ? 'warn' : 'ok'} />
        <Row
          label="long tasks"
          hint="main-thread tasks over 50ms, per second"
          value={g ? n1(g.longTasksPerSec) : dash}
          level={g && g.longTasksPerSec > 0 ? 'warn' : 'ok'}
        />
        <Row
          label="decoders"
          hint="open video decoders / live playbacks"
          value={`${s.totals.decoders} / ${s.totals.voices}`}
          level={s.totals.decoders > 6 ? 'warn' : 'ok'}
        />
        <Row
          label="memory"
          hint="JS heap / decoded-frame pools (estimate)"
          value={`${s.memory.jsHeapMB === null ? 'n/a' : mb(s.memory.jsHeapMB)} / ${mb(s.memory.framePoolMB)}`}
        />
      </div>

      <table className="perf__banks">
        <thead>
          <tr>
            <th />
            {Array.from({ length: BANK_COUNT }, (_, i) => (
              <th key={i} style={bankStyle(i)}>
                <span className="perf__bank">{i + 1}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bankRows.map((r) => (
            <tr key={r.label} title={r.hint}>
              <th scope="row">{r.label}</th>
              {Array.from({ length: BANK_COUNT }, (_, i) => {
                const [v, level = 'ok'] = r.cell(i);
                return (
                  <td key={i} className={`perf__value--${level}`}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
