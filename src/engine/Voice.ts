import { CanvasSink, type WrappedCanvas } from 'mediabunny';
import type { Clip } from './Clip';

/**
 * One triggered playback of a clip between trimStart and trimEnd, starting at AudioContext time `when`.
 * Audio is sample-accurate via AudioBufferSourceNode; video frames are pulled from a mediabunny
 * CanvasSink iterator and kept in sync with the audio clock.
 */
export class Voice {
  readonly when: number;
  stopAt: number;

  private readonly clip: Clip;
  private readonly actx: AudioContext;
  private readonly trimStart: number;
  private readonly src: AudioBufferSourceNode | null = null;
  private readonly iter: AsyncGenerator<WrappedCanvas, void, unknown>;
  private current: WrappedCanvas | null = null;
  private next: WrappedCanvas | null = null;
  private pending = false;
  private done = false;
  private disposed = false;

  constructor(clip: Clip, actx: AudioContext, out: AudioNode, when: number, trimStart: number, trimEnd: number) {
    this.clip = clip;
    this.actx = actx;
    this.trimStart = trimStart;
    this.when = when;
    const dur = trimEnd - trimStart;
    this.stopAt = when + dur;

    if (clip.audio && trimStart < clip.audio.duration) {
      const src = actx.createBufferSource();
      src.buffer = clip.audio;
      src.connect(out);
      src.start(when, trimStart, dur);
      this.src = src;
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
        // Decoder is behind the clock (or this is the first frame): take it and keep pulling.
        if (!this.current || r.value.timestamp <= this.mediaTime()) {
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
    if (this.next && this.next.timestamp <= this.mediaTime()) {
      this.current = this.next;
      this.next = null;
      this.pull();
    }
    return this.current?.canvas ?? null;
  }

  stop(at: number) {
    if (at >= this.stopAt) return;
    this.stopAt = Math.max(at, this.when);
    try {
      this.src?.stop(this.stopAt);
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
    this.current = this.next = null;
    this.iter.return().catch(() => {});
  }
}
