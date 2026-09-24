import { QUALITY_PROFILES, type QualityProfile } from '../../config/defaults';
import type { MyFishPondSettings, QualityMode } from '../../types';

export class PerformanceManager {
  private profile: QualityProfile;
  private paused = false;

  constructor(private settings: MyFishPondSettings) {
    this.profile = QUALITY_PROFILES[settings.qualityMode];
  }

  get qualityMode() {
    return this.settings.qualityMode;
  }

  get qualityProfile() {
    return this.profile;
  }

  get targetFishCount() {
    return this.settings.fishCount;
  }

  get targetFps() {
    return this.paused ? 0 : this.profile.targetFps;
  }

  get isPaused() {
    return this.paused;
  }

  setQualityMode(mode: QualityMode) {
    this.settings.qualityMode = mode;
    this.profile = QUALITY_PROFILES[mode];
    this.settings.fishCount = this.profile.fishCount;
  }

  setFishCount(count: number) {
    this.settings.fishCount = Math.max(6, Math.min(60, Math.round(count)));
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  getSettings() {
    return { ...this.settings };
  }
}
