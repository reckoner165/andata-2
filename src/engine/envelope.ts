/** Amplitude envelope applied to each triggered voice. Times in seconds, sustain 0…1. */
export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** Neutral: plays the clip as recorded (edges still get a few ms to avoid clicks). */
export const DEFAULT_ENVELOPE: Envelope = { attack: 0, decay: 0, sustain: 1, release: 0 };

export const MIN_ATTACK = 0.002;
export const MIN_RELEASE = 0.005;

/** [time since trigger, gain] breakpoints, joined by straight lines. */
export type Breakpoints = [t: number, v: number][];

/** Gain at time `t` along piecewise-linear breakpoints (held after the last one). */
export function valueAt(points: Breakpoints, t: number) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * Envelope for a clip segment of length `dur`: attack and decay from the trigger, sustain,
 * and a release timed to reach silence exactly at the end of the segment. If the segment is
 * too short for the whole shape, the release starts early from wherever the curve got to.
 */
export function envelopeBreakpoints(env: Envelope, dur: number): Breakpoints {
  const a = Math.max(env.attack, MIN_ATTACK);
  const r = Math.min(Math.max(env.release, MIN_RELEASE), dur);
  const shape: Breakpoints = [
    [0, 0],
    [a, 1],
    [a + env.decay, env.sustain],
  ];
  const relStart = Math.max(0, dur - r);
  const kept = shape.filter(([t]) => t < relStart);
  return [...kept, [relStart, valueAt(shape, relStart)], [dur, 0]];
}
