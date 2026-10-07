export const BANK_COLORS = ['#ff5a36', '#ffc531', '#3ddc97', '#4aa8ff'];

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
}

export const emptyBank = (): BankUI => ({
  hasClip: false,
  loading: false,
  duration: 0,
  thumbUrl: null,
  trimStart: 0,
  trimEnd: 0,
  choke: true,
  gain: 1,
  pan: 0,
});

export const fmtTime = (s: number) => `${s.toFixed(2)}s`;
