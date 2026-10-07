import type { Clip } from './Clip';
import { DEFAULT_ENVELOPE, type Envelope } from './envelope';
import { DEFAULT_CRUSH, defaultFx, type CrushFx, type DuotoneFx } from './fx';
import { Voice } from './Voice';

const MAX_VOICES = 4;
const MIN_LENGTH = 0.02;

export class Bank {
  readonly index: number;
  clip: Clip | null = null;
  trimStart = 0;
  trimEnd = 0;
  /** When true, a retrigger cuts the previous voice; otherwise voices overlap. */
  choke = true;
  /** Applied to voices triggered from now on. */
  envelope: Envelope = { ...DEFAULT_ENVELOPE };
  /** Video effect for this bank's tile; colours live in the matching SVG filter. */
  fx: DuotoneFx = defaultFx('#ffffff');
  crush: CrushFx = { ...DEFAULT_CRUSH };
  readonly gain: GainNode;
  readonly panner: StereoPannerNode;

  private readonly actx: AudioContext;
  private voices: Voice[] = [];
  private lastFrame: CanvasImageSource | null = null;

  constructor(index: number, actx: AudioContext, out: AudioNode) {
    this.index = index;
    this.actx = actx;
    this.gain = actx.createGain();
    this.panner = actx.createStereoPanner();
    this.gain.connect(this.panner).connect(out);
  }

  setClip(clip: Clip | null) {
    this.stopAll();
    this.clip?.dispose();
    this.clip = clip;
    this.trimStart = 0;
    this.trimEnd = clip?.duration ?? 0;
  }

  setGain(value: number) {
    this.gain.gain.setTargetAtTime(value, this.actx.currentTime, 0.015);
  }

  /** -1 (left) … 1 (right). */
  setPan(value: number) {
    this.panner.pan.setTargetAtTime(value, this.actx.currentTime, 0.015);
  }

  trigger(when: number) {
    const clip = this.clip;
    if (!clip || this.trimEnd - this.trimStart < MIN_LENGTH) return;

    if (this.choke) {
      for (const v of this.voices) v.stop(when);
    } else {
      const sounding = this.voices.filter((v) => v.stopAt > when);
      for (let i = 0; i <= sounding.length - MAX_VOICES; i++) sounding[i].stop(when);
    }
    this.voices.push(new Voice(clip, this.actx, this.gain, when, this.trimStart, this.trimEnd, this.envelope));
  }

  /** Newest voice sounding at `now`. */
  private activeVoice(now: number) {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i].isActive(now)) return this.voices[i];
    }
    return null;
  }

  isActive(now: number) {
    return this.activeVoice(now) !== null;
  }

  frame(now: number): CanvasImageSource | null {
    const f = this.activeVoice(now)?.frame();
    // Hold the previous frame while a freshly triggered voice is still seeking.
    if (f) this.lastFrame = f;
    return f ?? this.lastFrame;
  }

  cleanup(now: number) {
    if (!this.voices.length) return;
    this.voices = this.voices.filter((v) => {
      // keep choked voices alive until their release tail has finished
      if (Math.max(v.stopAt, v.audioEnd) > now) return true;
      v.dispose();
      return false;
    });
  }

  stopAll() {
    for (const v of this.voices) v.dispose();
    this.voices = [];
    this.lastFrame = null;
  }
}
