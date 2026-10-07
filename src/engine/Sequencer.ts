import type { Bank } from './Bank';

export const STEPS = 16;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

export interface SequencerState {
  grid: boolean[][];
  bpm: number;
  /** Muted rows are never triggered (no voices, no decoding). */
  muted: boolean[];
}

/** Lookahead step scheduler driven by the AudioContext clock (16th-note steps). */
export class Sequencer {
  playing = false;

  private readonly actx: AudioContext;
  private readonly banks: Bank[];
  private readonly getState: () => SequencerState;
  private timer = 0;
  private nextTime = 0;
  private nextStep = 0;
  private queue: { step: number; time: number }[] = [];
  private shownStep = -1;

  constructor(actx: AudioContext, banks: Bank[], getState: () => SequencerState) {
    this.actx = actx;
    this.banks = banks;
    this.getState = getState;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.nextStep = 0;
    this.nextTime = this.actx.currentTime + 0.05;
    this.queue = [];
    this.shownStep = -1;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    window.clearInterval(this.timer);
    this.playing = false;
    this.queue = [];
    this.shownStep = -1;
  }

  private tick() {
    const { grid, bpm, muted } = this.getState();
    const horizon = this.actx.currentTime + LOOKAHEAD;
    while (this.nextTime < horizon) {
      for (let b = 0; b < this.banks.length; b++) {
        if (grid[b]?.[this.nextStep] && !muted[b]) this.banks[b].trigger(this.nextTime);
      }
      this.queue.push({ step: this.nextStep, time: this.nextTime });
      this.nextTime += 60 / bpm / 4;
      this.nextStep = (this.nextStep + 1) % STEPS;
    }
  }

  /** The step currently sounding, for the UI playhead (-1 when stopped). */
  currentStep(now: number) {
    while (this.queue.length && this.queue[0].time <= now) this.shownStep = this.queue.shift()!.step;
    return this.playing ? this.shownStep : -1;
  }
}
