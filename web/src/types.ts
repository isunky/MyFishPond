export type QualityMode = 'eco' | 'standard' | 'high';

export interface MyFishPondSettings {
  qualityMode: QualityMode;
  fishCount: number;
  fishSpeed: number;
  schooling: number;
  mouseScare: boolean;
  clickRipple: boolean;
  feeding: boolean;
  waterMotion: boolean;
  caustics: boolean;
  particles: boolean;
  bubbles: boolean;
  autoPauseFullscreen: boolean;
}

export interface DisplayInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export type PondLifecycleEvent = 'pause' | 'resume';

export interface PlatformAdapter {
  readonly platform: 'windows' | 'macos' | 'web';
  getDisplayInfo(): DisplayInfo;
  isVisible(): boolean;
  isFullscreenAppActive(): boolean;
  on(event: PondLifecycleEvent, callback: () => void): () => void;
  getSettings(): Promise<MyFishPondSettings | null>;
  saveSettings(settings: MyFishPondSettings): Promise<void>;
  destroy(): void;
}
