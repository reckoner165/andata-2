import { DEFAULT_ENVELOPE, type Envelope } from './engine/envelope';
import { defaultFx, type DuotoneFx } from './engine/fx';

// Wada Sanzo, classic combination 289, in the published order:
// Lemon Yellow, Light Green Yellow, Violet Blue, Dull Violet Black.
export const BANK_COLORS = ['#f8ed43', '#c7d14f', '#40456a', '#0d1c43'];
/** Text colour for each bank colour, whichever of paper/ink reads better on it. */
export const BANK_TEXT = ['#141414', '#141414', '#f9f8f5', '#f9f8f5'];
/** Bank colour for drawing on the black screens; the two blues are lifted so they stay visible. */
export const BANK_SCREEN = ['#f8ed43', '#c7d14f', '#a4a8d6', '#7487b8'];

/** CSS vars for bank `i`: its colour and the text colour to put on it. */
export const bankStyle = (i: number) =>
  ({ '--bank': BANK_COLORS[i], '--bank-ink': BANK_TEXT[i] }) as React.CSSProperties;

export interface BankUI {
  hasClip: boolean;
  loading: boolean;
  duration: number;
  thumbUrl: string | null;
  trimStart: number;
  trimEnd: number;
  choke: boolean;
  gain: number;
  /** -1 (left) … 1 (right). */
  pan: number;
  envelope: Envelope;
  /** Strip shows the envelope editor instead of trim/gain/pan. */
  showAdsr: boolean;
  fx: DuotoneFx;
}

export const emptyBank = (index: number): BankUI => ({
  hasClip: false,
  loading: false,
  duration: 0,
  thumbUrl: null,
  trimStart: 0,
  trimEnd: 0,
  choke: true,
  gain: 1,
  pan: 0,
  envelope: { ...DEFAULT_ENVELOPE },
  showAdsr: false,
  fx: defaultFx(BANK_SCREEN[index]),
});

export const fmtTime = (s: number) => `${s.toFixed(2)}s`;
