import { Bank } from './Bank';
import { downloadBlob, startCapture, type Capture } from './capture';
import { Clip } from './Clip';
import { drawCover, tileRects } from './layout';
import { Sequencer, STEPS } from './Sequencer';

export const BANK_COUNT = 4;
export type Orientation = 'landscape' | 'portrait';
/** Stage canvas size per orientation; the canvas size is also the bounce resolution. */
export const STAGE_SIZE: Record<Orientation, [w: number, h: number]> = {
  landscape: [1280, 720],
  portrait: [720, 1280],
};

export const emptyGrid = () => Array.from({ length: BANK_COUNT }, () => Array<boolean>(STEPS).fill(false));

/** Owns the audio graph, banks, sequencer, compositor loop and recorders. Framework-free. */
export class Engine {
  grid: boolean[][] = emptyGrid();
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
      this.banks = Array.from({ length: BANK_COUNT }, (_, i) => new Bank(i, ctx, master));
      this.seq = new Sequencer(ctx, this.banks, () => this);
      this.ctx = ctx;
    }
    await this.ctx.resume();
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
      if (img) drawCover(g, img, rects[i]);
    });

    const step = this.seq?.currentStep(now) ?? -1;
    if (step !== this.lastStep) {
      this.lastStep = step;
      this.onStep(step);
    }
  };
}
