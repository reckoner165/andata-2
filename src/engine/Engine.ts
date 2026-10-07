import { Bank } from './Bank';
import { downloadBlob, startCapture, type Capture } from './capture';
import { Clip } from './Clip';
import { anyFxActive, crushActive, drawWithFx } from './fx';
import { EnginePerf, type BankWindow, type GlobalWindow } from './perf';
import { tileRects } from './layout';
import { Sequencer, STEPS } from './Sequencer';

export const BANK_COUNT = 4;
export type Orientation = 'landscape' | 'portrait';
/** Stage canvas size per orientation; the canvas size is also the bounce resolution. */
export const STAGE_SIZE: Record<Orientation, [w: number, h: number]> = {
  landscape: [1280, 720],
  portrait: [720, 1280],
};

export interface PerfSnapshot {
  /** last one-second window; null until the first window has elapsed */
  window: { global: GlobalWindow; banks: BankWindow[] } | null;
  powered: boolean;
  playing: boolean;
  bouncing: boolean;
  stage: { width: number; height: number; tiles: number };
  audio: { state: string; sampleRate: number; baseLatencyMs: number; outputLatencyMs: number } | null;
  memory: { jsHeapMB: number | null; clipFilesMB: number; clipAudioMB: number; framePoolMB: number };
  totals: { voices: number; sounding: number; decoders: number };
  banks: {
    clip: { duration: number; coded: string; decodeWidth: number; fileMB: number; audioMB: number } | null;
    muted: boolean;
    effects: string[];
    voices: number;
    sounding: number;
    decoders: number;
  }[];
}

/** Each voice's CanvasSink keeps a small pool of decoded canvases. */
const FRAME_POOL = 4;
const MB = 1024 * 1024;

export const emptyGrid = () => Array.from({ length: BANK_COUNT }, () => Array<boolean>(STEPS).fill(false));

/** Owns the audio graph, banks, sequencer, compositor loop and recorders. Framework-free. */
export class Engine {
  grid: boolean[][] = emptyGrid();
  muted: boolean[] = Array(BANK_COUNT).fill(false);
  bpm = 120;
  bg = '#000000';
  banks: Bank[] = [];
  stream: MediaStream | null = null;
  onStep: (step: number) => void = () => {};

  private ctx: AudioContext | null = null;
  private bounceDest: MediaStreamAudioDestinationNode | null = null;
  private master: GainNode | null = null;
  private masterVolume = 1;
  private meters: AnalyserNode[] = [];
  private meterBuf = new Float32Array(1024);
  private seq: Sequencer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private lastStep = -1;
  private clipCapture: Capture | null = null;
  private bounce: { capture: Capture; stream: MediaStream } | null = null;
  /** Per-bank scratch canvases for pixelation. */
  private scratch: HTMLCanvasElement[] = [];
  private tiles = 0;
  readonly perf = new EnginePerf(BANK_COUNT);

  attachCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.clearStage();
  }

  async powerOn() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      const master = ctx.createGain();
      master.gain.value = this.masterVolume;
      master.connect(ctx.destination);
      this.bounceDest = ctx.createMediaStreamDestination();
      master.connect(this.bounceDest);
      // Post-fader stereo metering.
      const splitter = ctx.createChannelSplitter(2);
      master.connect(splitter);
      this.meters = [0, 1].map((ch) => {
        const a = ctx.createAnalyser();
        a.fftSize = this.meterBuf.length;
        splitter.connect(a, ch);
        return a;
      });
      this.master = master;
      this.banks = Array.from({ length: BANK_COUNT }, (_, i) => new Bank(i, ctx, master, this.perf.banks[i]));
      this.seq = new Sequencer(ctx, this.banks, () => this, this.perf);
      this.ctx = ctx;
    }
    await this.ctx.resume();
    this.perf.reset();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  async powerOff() {
    this.stop();
    await this.cancelClipRecording();
    if (this.bounce) await this.stopBounce().catch((e) => console.error(e));
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clearStage();
    this.closeStream();
    await this.ctx?.suspend();
  }

  async openStream(videoDeviceId?: string, audioDeviceId?: string) {
    this.closeStream();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: {
        deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
        // Raw signal for musical use; processing would duck and gate the loops.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    return this.stream;
  }

  private closeStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  // ---- bank recording ----

  async startClipRecording() {
    const video = this.stream?.getVideoTracks()[0];
    if (!video) throw new Error('No video source selected.');
    const audio = this.stream?.getAudioTracks()[0] ?? null;
    this.clipCapture = await startCapture(video, audio, { keyFrameInterval: 0.5 });
  }

  async finishClipRecording(bankIndex: number): Promise<Clip> {
    const capture = this.clipCapture;
    if (!capture || !this.ctx) throw new Error('Not recording.');
    this.clipCapture = null;
    const clip = await Clip.load(await capture.stop(), this.ctx);
    this.banks[bankIndex].setClip(clip);
    return clip;
  }

  async cancelClipRecording() {
    const capture = this.clipCapture;
    this.clipCapture = null;
    await capture?.cancel().catch(() => {});
  }

  clearBank(i: number) {
    this.banks[i]?.setClip(null);
  }

  audition(i: number) {
    if (this.ctx) this.banks[i]?.trigger(this.ctx.currentTime + 0.03);
  }

  // ---- master ----

  setMasterVolume(value: number) {
    this.masterVolume = value;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.015);
  }

  /** Current post-fader peak per channel (linear, 0…1+); zeros while powered off. */
  meterPeaks(): [number, number] {
    if (this.ctx?.state !== 'running') return [0, 0];
    const peaks = this.meters.map((a) => {
      a.getFloatTimeDomainData(this.meterBuf);
      let peak = 0;
      for (const v of this.meterBuf) peak = Math.max(peak, Math.abs(v));
      return peak;
    });
    return [peaks[0] ?? 0, peaks[1] ?? 0];
  }

  /** Mute a sequencer row: it stops triggering, and anything it is playing is released now. */
  setMuted(i: number, muted: boolean) {
    this.muted[i] = muted;
    if (muted) this.banks[i]?.stopAll();
  }

  // ---- transport ----

  play() {
    this.seq?.start();
  }

  stop() {
    this.seq?.stop();
    for (const b of this.banks) b.stopAll();
  }

  // ---- bounce ----

  async startBounce() {
    if (!this.canvas || !this.bounceDest) throw new Error('Power is off.');
    const stream = this.canvas.captureStream(30);
    const capture = await startCapture(stream.getVideoTracks()[0], this.bounceDest.stream.getAudioTracks()[0], {
      frameRate: 30,
      keyFrameInterval: 2,
    });
    this.bounce = { capture, stream };
  }

  async stopBounce() {
    const bounce = this.bounce;
    if (!bounce) return;
    this.bounce = null;
    try {
      const blob = await bounce.capture.stop();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(blob, `andata-2-${stamp}.mp4`);
    } finally {
      bounce.stream.getTracks().forEach((t) => t.stop());
    }
  }

  // ---- compositor ----

  private clearStage() {
    const c = this.canvas;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.fillStyle = this.bg;
    g.fillRect(0, 0, c.width, c.height);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const ctx = this.ctx;
    const c = this.canvas;
    const g = c?.getContext('2d');
    if (!ctx || !c || !g) return;
    const t0 = performance.now();
    this.perf.frameStart(t0);
    // Read the size every frame: the orientation toggle resizes the canvas.
    const W = c.width;
    const H = c.height;
    const now = ctx.currentTime;

    for (const b of this.banks) b.cleanup(now);
    const active = this.banks.filter((b) => b.isActive(now));
    const rects = tileRects(active.length, W, H);

    g.fillStyle = this.bg;
    g.fillRect(0, 0, W, H);
    active.forEach((b, i) => {
      const img = b.frame(now);
      if (!img) return;
      const scratch = (this.scratch[b.index] ??= document.createElement('canvas'));
      const d0 = performance.now();
      drawWithFx(g, img, rects[i], b.index, b.fx, b.crush, scratch);
      b.stats.draw.add(performance.now() - d0);
    });
    this.tiles = active.length;

    const step = this.seq?.currentStep(now) ?? -1;
    if (step !== this.lastStep) {
      this.lastStep = step;
      this.onStep(step);
    }

    const t1 = performance.now();
    this.perf.frameWork.add(t1 - t0);
    this.perf.roll(t1);
  };

  /** Live performance figures for the perf tab: last 1s window plus current state. */
  perfSnapshot(): PerfSnapshot {
    const ctx = this.ctx;
    const now = ctx?.currentTime ?? 0;
    const banks = this.banks.map((b, i) => {
      const clip = b.clip;
      const effects = [b.fx.amount > 0 ? 'two-tone' : '', crushActive(b.crush) ? 'crush' : ''].filter(Boolean);
      return {
        clip: clip && {
          duration: clip.duration,
          coded: `${clip.videoTrack.codedWidth}×${clip.videoTrack.codedHeight}`,
          decodeWidth: clip.renderWidth,
          fileMB: clip.fileBytes / MB,
          audioMB: clip.audio ? (clip.audio.length * clip.audio.numberOfChannels * 4) / MB : 0,
        },
        muted: this.muted[i],
        effects: anyFxActive(b.fx, b.crush) ? effects : [],
        voices: b.voiceCount,
        sounding: b.soundingCount(now),
        decoders: b.decodersOpen,
      };
    });
    // decoded-frame pools held by open decoders
    const framePoolMB = this.banks.reduce((sum, b) => {
      const clip = b.clip;
      if (!clip) return sum;
      const h = clip.renderWidth * (clip.videoTrack.displayHeight / clip.videoTrack.displayWidth);
      return sum + (b.decodersOpen * FRAME_POOL * clip.renderWidth * h * 4) / MB;
    }, 0);
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      window: this.perf.last,
      powered: this.raf !== 0,
      playing: this.seq?.playing ?? false,
      bouncing: this.bounce !== null,
      stage: { width: this.canvas?.width ?? 0, height: this.canvas?.height ?? 0, tiles: this.tiles },
      audio: ctx && {
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatencyMs: (ctx.baseLatency ?? 0) * 1000,
        outputLatencyMs: (ctx.outputLatency ?? 0) * 1000,
      },
      memory: {
        jsHeapMB: heap ? heap.usedJSHeapSize / MB : null,
        clipFilesMB: banks.reduce((s, b) => s + (b.clip?.fileMB ?? 0), 0),
        clipAudioMB: banks.reduce((s, b) => s + (b.clip?.audioMB ?? 0), 0),
        framePoolMB,
      },
      totals: {
        voices: banks.reduce((s, b) => s + b.voices, 0),
        sounding: banks.reduce((s, b) => s + b.sounding, 0),
        decoders: banks.reduce((s, b) => s + b.decoders, 0),
      },
      banks,
    };
  }
}
