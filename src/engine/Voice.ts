import { CanvasSink, type WrappedCanvas } from 'mediabunny';
import type { Clip } from './Clip';
import { envelopeBreakpoints, MIN_RELEASE, valueAt, type Breakpoints, type Envelope } from './envelope';
import type { BankPerf } from './perf';

/**
 * One triggered playback of a clip between trimStart and trimEnd, starting at AudioContext time `when`.
 * Audio is sample-accurate via AudioBufferSourceNode; video frames are pulled from a mediabunny
 * CanvasSink iterator and kept in sync with the audio clock.
 */
export class Voice {
  readonly when: number;
  /** When the video stops showing (clip end, or the moment it was choked). */
  stopAt: number;
  /** When the audio has fully released; the voice is kept alive until then. */
  audioEnd: number;

  private readonly clip: Clip;
  private readonly actx: AudioContext;
  private readonly trimStart: number;
  private readonly src: AudioBufferSourceNode | null = null;
  private readonly envGain: GainNode | null = null;
  private readonly release: number;
  private points: Breakpoints;
  private readonly stats: BankPerf;
  private readonly createdAt = performance.now();
  private gotFirst = false;
  private readonly iter: AsyncGenerator<WrappedCanvas, void, unknown>;
  private current: WrappedCanvas | null = null;
  private next: WrappedCanvas | null = null;
  private pending = false;
  private done = false;
  private disposed = false;

  constructor(
    clip: Clip,
    actx: AudioContext,
    out: AudioNode,
    when: number,
    trimStart: number,
    trimEnd: number,
    env: Envelope,
    stats: BankPerf,
  ) {
    this.stats = stats;
    this.clip = clip;
    this.actx = actx;
    this.trimStart = trimStart;
    this.when = when;
    const dur = trimEnd - trimStart;
    this.stopAt = when + dur;
    this.audioEnd = when + dur;
    this.release = Math.max(env.release, MIN_RELEASE);
    this.points = envelopeBreakpoints(env, dur);

    if (clip.audio && trimStart < clip.audio.duration) {
      const src = actx.createBufferSource();
      src.buffer = clip.audio;
      const envGain = actx.createGain();
      const g = envGain.gain;
      g.setValueAtTime(0, when);
      for (const [t, v] of this.points.slice(1)) g.linearRampToValueAtTime(v, when + t);
      src.connect(envGain).connect(out);
      src.start(when, trimStart, dur);
      this.src = src;
      this.envGain = envGain;
    }

    // Each voice gets its own sink so canvas pools are never shared between concurrent iterators.
    const sink = new CanvasSink(clip.videoTrack, { width: clip.renderWidth, poolSize: 4 });
    this.iter = sink.canvases(clip.t0 + trimStart, clip.t0 + trimEnd);
    this.pull();
  }

  private mediaTime() {
    return this.clip.t0 + this.trimStart + Math.max(0, this.actx.currentTime - this.when);
  }

  private pull() {
    if (this.pending || this.done || this.disposed) return;
    this.pending = true;
    this.iter.next().then(
      (r) => {
        this.pending = false;
        if (this.disposed) return;
        if (r.done) {
          this.done = true;
          return;
        }
        this.stats.decoded++;
        if (!this.gotFirst) {
          this.gotFirst = true;
          this.stats.startup.add(performance.now() - this.createdAt);
        }
        // Decoder is behind the clock (or this is the first frame): take it and keep pulling.
        if (!this.current || r.value.timestamp <= this.mediaTime()) {
          if (this.current) this.stats.shown++;
          this.current = r.value;
          this.pull();
        } else {
          this.next = r.value;
        }
      },
      () => {
        this.pending = false;
        this.done = true;
      },
    );
  }

  isActive(now: number) {
    return now >= this.when && now < this.stopAt;
  }

  /** The frame to display right now, or null if none is decoded yet. */
  frame(): CanvasImageSource | null {
    const t = this.mediaTime();
    if (this.next && this.next.timestamp <= t) {
      this.current = this.next;
      this.next = null;
      this.stats.shown++;
      this.pull();
    }
    const cur = this.current;
    if (!cur) {
      this.stats.stalls++;
      return null;
    }
    const lag = (t - (cur.timestamp + cur.duration)) * 1000;
    if (lag > this.stats.lag) this.stats.lag = lag;
    return cur.canvas;
  }

  /** Whether this voice still holds a live video decoder. */
  get decoderOpen() {
    return !this.done && !this.disposed;
  }

  /** Choke: video cuts at `at`; audio releases from its current level over the release time. */
  stop(at: number) {
    if (at >= this.stopAt) return;
    at = Math.max(at, this.when);
    this.stopAt = at;
    const end = Math.min(this.audioEnd, at + this.release);
    this.audioEnd = end;
    if (!this.src || !this.envGain) return;
    const g = this.envGain.gain;
    const level = valueAt(this.points, at - this.when);
    if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(at);
    else {
      g.cancelScheduledValues(at);
      g.setValueAtTime(level, at);
    }
    g.linearRampToValueAtTime(0, end);
    try {
      this.src.stop(end);
    } catch {
      /* already stopped */
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src?.disconnect();
    this.envGain?.disconnect();
    this.current = this.next = null;
    this.iter.return().catch(() => {});
  }
}
