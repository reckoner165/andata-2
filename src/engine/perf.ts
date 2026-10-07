/**
 * Lightweight performance counters. Hot paths only bump counters / push samples;
 * everything is summarised once a second in `roll()`, and the UI reads the last summary.
 */

export interface Summary {
  min: number;
  avg: number;
  p95: number;
  max: number;
  n: number;
}

/** Samples collected over one window. */
export class Stat {
  private v: number[] = [];
  add(x: number) {
    this.v.push(x);
  }
  take(): Summary {
    const v = this.v;
    this.v = [];
    if (!v.length) return { min: 0, avg: 0, p95: 0, max: 0, n: 0 };
    const sorted = [...v].sort((a, b) => a - b);
    return {
      min: sorted[0],
      avg: v.reduce((a, b) => a + b, 0) / v.length,
      p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
      max: sorted[sorted.length - 1],
      n: v.length,
    };
  }
}

export interface BankWindow {
  triggersPerSec: number;
  decodedPerSec: number;
  shownPerSec: number;
  stallsPerSec: number;
  startupMs: Summary;
  drawMs: Summary;
  /** worst amount the shown frame was behind the audio clock */
  lagMs: number;
}

/** Per-bank counters, fed by Bank / Voice / the compositor. */
export class BankPerf {
  triggers = 0;
  decoded = 0;
  shown = 0;
  stalls = 0;
  lag = 0;
  readonly startup = new Stat();
  readonly draw = new Stat();

  take(seconds: number): BankWindow {
    const w: BankWindow = {
      triggersPerSec: this.triggers / seconds,
      decodedPerSec: this.decoded / seconds,
      shownPerSec: this.shown / seconds,
      stallsPerSec: this.stalls / seconds,
      startupMs: this.startup.take(),
      drawMs: this.draw.take(),
      lagMs: this.lag,
    };
    this.triggers = this.decoded = this.shown = this.stalls = this.lag = 0;
    return w;
  }
}

export interface GlobalWindow {
  fps: number;
  frameMs: Summary;
  droppedPerSec: number;
  longTasksPerSec: number;
  longTaskMs: number;
  /** how far ahead of its trigger time each step was scheduled (lower = closer to late) */
  headroomMs: Summary;
  lateTriggers: number;
  /** scheduler timer interval (target 25ms); spikes mean the main thread was busy */
  tickGapMs: Summary;
}

export class EnginePerf {
  readonly frameWork = new Stat();
  readonly headroom = new Stat();
  readonly tickGap = new Stat();
  readonly banks: BankPerf[];
  lateTriggers = 0;
  last: { global: GlobalWindow; banks: BankWindow[] } | null = null;

  private frames = 0;
  private gaps: number[] = [];
  private lastFrameAt = 0;
  private lastTickAt = 0;
  private longTasks = 0;
  private longTaskMs = 0;
  private windowStart = performance.now();

  constructor(bankCount: number) {
    this.banks = Array.from({ length: bankCount }, () => new BankPerf());
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          this.longTasks++;
          this.longTaskMs += e.duration;
        }
      }).observe({ type: 'longtask', buffered: false });
    } catch {
      /* long-task timing not supported (non-Chromium) */
    }
  }

  /** Called at the start of every compositor frame. */
  frameStart(now: number) {
    if (this.lastFrameAt) this.gaps.push(now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.frames++;
  }

  /** Called on every scheduler tick. */
  tick(now: number) {
    if (this.lastTickAt) this.tickGap.add(now - this.lastTickAt);
    this.lastTickAt = now;
  }

  /** Summarise and reset roughly once a second. */
  roll(now: number) {
    const seconds = (now - this.windowStart) / 1000;
    if (seconds < 1) return;
    // a frame is "dropped" when its gap is well over the display's refresh interval,
    // estimated as the median gap (the minimum is thrown off by back-to-back callbacks)
    const sortedGaps = [...this.gaps].sort((a, b) => a - b);
    const refresh = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 16.7;
    const dropped = this.gaps.filter((g) => g > refresh * 1.5).reduce((n, g) => n + Math.round(g / refresh) - 1, 0);
    this.last = {
      global: {
        fps: this.frames / seconds,
        frameMs: this.frameWork.take(),
        droppedPerSec: dropped / seconds,
        longTasksPerSec: this.longTasks / seconds,
        longTaskMs: this.longTaskMs,
        headroomMs: this.headroom.take(),
        lateTriggers: this.lateTriggers,
        tickGapMs: this.tickGap.take(),
      },
      banks: this.banks.map((b) => b.take(seconds)),
    };
    this.frames = 0;
    this.gaps = [];
    this.longTasks = this.longTaskMs = 0;
    this.lateTriggers = 0;
    this.windowStart = now;
  }

  /** Forget timing continuity (e.g. after power off / on). */
  reset() {
    this.lastFrameAt = this.lastTickAt = 0;
    this.windowStart = performance.now();
  }
}
