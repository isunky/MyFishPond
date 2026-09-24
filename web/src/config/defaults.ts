import type { MyFishPondSettings, QualityMode } from '../types';

export interface QualityProfile {
  targetFps: number;
  renderScale: number;
  fishCount: number;
  boidsHz: number;
  behaviorHz: number;
  particleLimit: number;
  shaderQuality: 'off' | 'light' | 'full';
}

export const QUALITY_PROFILES: Record<QualityMode, QualityProfile> = {
  eco: {
    targetFps: 20,
    renderScale: 0.75,
    fishCount: 15,
    boidsHz: 8,
    behaviorHz: 5,
    particleLimit: 8,
    shaderQuality: 'off',
  },
  standard: {
    targetFps: 30,
    renderScale: 1,
    fishCount: 24,
    boidsHz: 12,
    behaviorHz: 5,
    particleLimit: 20,
    shaderQuality: 'light',
  },
  high: {
    targetFps: 60,
    renderScale: 1.25,
    fishCount: 35,
    boidsHz: 20,
    behaviorHz: 5,
    particleLimit: 40,
    shaderQuality: 'full',
  },
};

export const DEFAULT_SETTINGS: MyFishPondSettings = {
  qualityMode: 'standard',
  fishCount: 24,
  fishSpeed: 1,
  schooling: 0.55,
  mouseScare: true,
  clickRipple: true,
  feeding: false,
  waterMotion: true,
  caustics: true,
  particles: true,
  bubbles: true,
  autoPauseFullscreen: true,
};

export const SETTINGS_STORAGE_KEY = 'my-fish-pond.settings.v1';

export function normalizeSettings(value: unknown): MyFishPondSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };

  const candidate = value as Partial<MyFishPondSettings>;
  const qualityMode: QualityMode =
    candidate.qualityMode === 'eco' || candidate.qualityMode === 'high'
      ? candidate.qualityMode
      : 'standard';

  return {
    ...DEFAULT_SETTINGS,
    ...candidate,
    qualityMode,
    fishCount: clampNumber(candidate.fishCount, 6, 60, DEFAULT_SETTINGS.fishCount),
    fishSpeed: clampNumber(candidate.fishSpeed, 0.5, 1.8, DEFAULT_SETTINGS.fishSpeed),
    schooling: clampNumber(candidate.schooling, 0, 1, DEFAULT_SETTINGS.schooling),
    mouseScare: booleanOr(candidate.mouseScare, DEFAULT_SETTINGS.mouseScare),
    clickRipple: booleanOr(candidate.clickRipple, DEFAULT_SETTINGS.clickRipple),
    feeding: booleanOr(candidate.feeding, DEFAULT_SETTINGS.feeding),
    waterMotion: booleanOr(candidate.waterMotion, DEFAULT_SETTINGS.waterMotion),
    caustics: booleanOr(candidate.caustics, DEFAULT_SETTINGS.caustics),
    particles: booleanOr(candidate.particles, DEFAULT_SETTINGS.particles),
    bubbles: booleanOr(candidate.bubbles, DEFAULT_SETTINGS.bubbles),
    autoPauseFullscreen: booleanOr(
      candidate.autoPauseFullscreen,
      DEFAULT_SETTINGS.autoPauseFullscreen,
    ),
  };
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
