/**
 * Detector de 2 palmas por energia (P1) — puro, Node + browser.
 */

export type ClapConfig = {
  peakRatio: number;
  minPeak: number;
  minGapMs: number;
  maxGapMs: number;
  cooldownMs: number;
};

export const DEFAULT_CLAP_CONFIG: ClapConfig = {
  peakRatio: 3.2,
  minPeak: 0.12,
  minGapMs: 120,
  maxGapMs: 900,
  cooldownMs: 1800,
};

export type ClapDetectorState = {
  baseline: number;
  lastPeakAt: number;
  peaks: number[];
  cooldownUntil: number;
  inPeak: boolean;
};

export function createClapState(): ClapDetectorState {
  return {
    baseline: 0.02,
    lastPeakAt: 0,
    peaks: [],
    cooldownUntil: 0,
    inPeak: false,
  };
}

export function rmsFromTimeDomain(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(data.length, 1));
}

export function feedClapEnergy(
  state: ClapDetectorState,
  energy: number,
  nowMs: number,
  cfg: ClapConfig = DEFAULT_CLAP_CONFIG,
): boolean {
  if (nowMs < state.cooldownUntil) {
    state.baseline = state.baseline * 0.98 + energy * 0.02;
    state.inPeak = false;
    return false;
  }

  if (energy < state.baseline * 1.4) {
    state.baseline = state.baseline * 0.95 + energy * 0.05;
  } else {
    state.baseline = state.baseline * 0.995 + energy * 0.005;
  }

  const threshold = Math.max(cfg.minPeak, state.baseline * cfg.peakRatio);
  const isHot = energy >= threshold;

  if (isHot && !state.inPeak) {
    state.inPeak = true;
    if (nowMs - state.lastPeakAt >= cfg.minGapMs) {
      state.peaks.push(nowMs);
      state.lastPeakAt = nowMs;
      state.peaks = state.peaks.filter((t) => nowMs - t <= cfg.maxGapMs);
      if (state.peaks.length >= 2) {
        const a = state.peaks[state.peaks.length - 2];
        const b = state.peaks[state.peaks.length - 1];
        const gap = b - a;
        if (gap >= cfg.minGapMs && gap <= cfg.maxGapMs) {
          state.peaks = [];
          state.cooldownUntil = nowMs + cfg.cooldownMs;
          return true;
        }
      }
    }
  } else if (!isHot) {
    state.inPeak = false;
  }

  return false;
}
