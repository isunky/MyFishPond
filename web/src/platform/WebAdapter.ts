import { DEFAULT_SETTINGS, normalizeSettings, SETTINGS_STORAGE_KEY } from '../config/defaults';
import type { MyFishPondSettings, PlatformAdapter, PondLifecycleEvent } from '../types';

export class WebAdapter implements PlatformAdapter {
  readonly platform = 'web' as const;
  private listeners = new Map<PondLifecycleEvent, Set<() => void>>();
  private disposed = false;
  private readonly handleVisibilityChange = () => {
    this.emit(document.hidden ? 'pause' : 'resume');
  };

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  getDisplayInfo() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  isVisible() {
    return !document.hidden;
  }

  isFullscreenAppActive() {
    return document.fullscreenElement !== null;
  }

  on(event: PondLifecycleEvent, callback: () => void) {
    const callbacks = this.listeners.get(event) ?? new Set<() => void>();
    callbacks.add(callback);
    this.listeners.set(event, callbacks);
    return () => {
      callbacks.delete(callback);
    };
  }

  async getSettings(): Promise<MyFishPondSettings | null> {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? normalizeSettings(JSON.parse(saved) as unknown) : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: MyFishPondSettings) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing or storage restrictions should not stop the pond.
    }
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listeners.clear();
  }

  private emit(event: PondLifecycleEvent) {
    this.listeners.get(event)?.forEach((callback) => callback());
  }
}
