import { Application, Assets, type Texture } from 'pixi.js';
import { DEFAULT_SETTINGS, normalizeSettings } from './config/defaults';
import { FishSimulation } from './core/fish/FishSimulation';
import { PerformanceManager } from './core/performance/PerformanceManager';
import { PondScene } from './core/scene/PondScene';
import { disposeFishTextures, loadFishTextures } from './core/scene/fishTextures';
import { WebAdapter } from './platform/WebAdapter';
import { DebugPanel } from './ui/debugPanel';
import './style.css';

const pondElement = document.querySelector<HTMLElement>('#pond')!;
const uiElement = document.querySelector<HTMLElement>('#app-ui')!;
const errorElement = document.querySelector<HTMLElement>('#startup-error')!;
const adapter = new WebAdapter();

async function startPond() {
  const savedSettings = await adapter.getSettings();
  const settings = normalizeSettings(savedSettings ?? DEFAULT_SETTINGS);
  const performanceManager = new PerformanceManager(settings);
  const display = adapter.getDisplayInfo();
  const app = new Application();

  try {
    await app.init({
      width: display.width,
      height: display.height,
      preference: 'webgl',
      preferWebGLVersion: 2,
      antialias: true,
      autoDensity: true,
      resolution: Math.max(0.5, Math.min(1.5, display.devicePixelRatio * performanceManager.qualityProfile.renderScale)),
      backgroundColor: 0x0b4e4e,
      powerPreference: 'low-power',
      autoStart: false,
      sharedTicker: false,
    });
  } catch {
    throw new Error('当前浏览器或显卡没有可用的 WebGL2。请更新浏览器驱动后重新打开鱼塘。');
  }

  const gl = 'gl' in app.renderer ? app.renderer.gl : null;
  if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
    app.destroy(true);
    throw new Error('鱼塘需要 WebGL2 渲染支持。请确认浏览器已启用硬件加速。');
  }

  pondElement.appendChild(app.canvas);
  const [textures, backgroundTexture] = await Promise.all([
    loadFishTextures(import.meta.env.BASE_URL),
    Assets.load<Texture>(`${import.meta.env.BASE_URL}images/pond-background.png`),
  ]);
  const scene = new PondScene(app.renderer, textures, backgroundTexture);
  app.stage.addChild(scene.stage);
  scene.resize(display.width, display.height);
  scene.applyProfile(performanceManager.qualityProfile, display.devicePixelRatio);
  scene.setFishCount(performanceManager.targetFishCount);
  const simulation = new FishSimulation(
    scene.fishEntities,
    () => ({ width: scene.width, height: scene.height }),
    () => performanceManager.qualityProfile,
    () => ({ fishSpeed: settings.fishSpeed, schooling: settings.schooling }),
    scene.random,
  );
  const panel = new DebugPanel(uiElement, settings, {
    onQualityChange: (quality) => {
      performanceManager.setQualityMode(quality);
      settings.qualityMode = quality;
      settings.fishCount = performanceManager.targetFishCount;
      scene.setFishCount(performanceManager.targetFishCount);
      scene.applyProfile(performanceManager.qualityProfile, adapter.getDisplayInfo().devicePixelRatio);
      app.ticker.maxFPS = performanceManager.qualityProfile.targetFps;
      app.render();
      panel.setFishValue(settings.fishCount);
      void adapter.saveSettings(settings);
    },
    onFishCountChange: (count) => {
      performanceManager.setFishCount(count);
      settings.fishCount = count;
      scene.setFishCount(performanceManager.targetFishCount);
      void adapter.saveSettings(settings);
    },
    onPauseToggle: () => {
      performanceManager.setPaused(!performanceManager.isPaused);
      if (performanceManager.isPaused) app.ticker.stop();
      else app.ticker.start();
      panel.renderStats({
        fps: performanceManager.isPaused ? 0 : fps,
        frameTime,
        fishCount: scene.fishCount,
        width: scene.width,
        height: scene.height,
        resolution: app.renderer.resolution,
        state: performanceManager.isPaused ? '已暂停' : '运行中',
      });
    },
    onReset: () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      performanceManager.setQualityMode(DEFAULT_SETTINGS.qualityMode);
      performanceManager.setFishCount(DEFAULT_SETTINGS.fishCount);
      scene.setFishCount(performanceManager.targetFishCount);
      scene.applyProfile(performanceManager.qualityProfile, adapter.getDisplayInfo().devicePixelRatio);
      app.ticker.maxFPS = performanceManager.qualityProfile.targetFps;
      app.render();
      panel.setQuality(settings.qualityMode);
      panel.setFishValue(settings.fishCount);
      void adapter.saveSettings(settings);
    },
  });

  app.ticker.maxFPS = performanceManager.qualityProfile.targetFps;
  let frameSamples = 0;
  let elapsedSampleMs = 0;
  let fps = performanceManager.qualityProfile.targetFps;
  let frameTime = 1_000 / performanceManager.qualityProfile.targetFps;

  const onPointerDown = (event: PointerEvent) => {
    if (!settings.clickRipple) return;
    const bounds = app.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * scene.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * scene.height;
    scene.addWaterRipple(x, y);
  };
  app.canvas.addEventListener('pointerdown', onPointerDown, { passive: true });

  app.ticker.add((ticker) => {
    simulation.update(ticker.deltaMS);
    scene.updateWater(ticker.deltaMS, settings.waterMotion, settings.caustics);
    elapsedSampleMs += ticker.deltaMS;
    frameSamples += 1;
    if (elapsedSampleMs >= 500) {
      fps = (frameSamples * 1_000) / elapsedSampleMs;
      frameTime = elapsedSampleMs / frameSamples;
      frameSamples = 0;
      elapsedSampleMs = 0;
      const current = performanceManager.isPaused || !adapter.isVisible() ? 0 : fps;
      panel.renderStats({
        fps: current,
        frameTime,
        fishCount: scene.fishCount,
        width: scene.width,
        height: scene.height,
        resolution: app.renderer.resolution,
        state: performanceManager.isPaused ? '已暂停' : '运行中',
      });
    }
  });

  const onResume = adapter.on('resume', () => {
    if (!performanceManager.isPaused) app.ticker.start();
  });
  const onPause = adapter.on('pause', () => {
    if (!performanceManager.isPaused) app.ticker.stop();
  });
  const onResize = () => {
    const next = adapter.getDisplayInfo();
    simulation.resize(next.width, next.height);
    scene.resize(next.width, next.height);
    app.renderer.resize(next.width, next.height);
    app.render();
  };
  window.addEventListener('resize', onResize, { passive: true });
  app.ticker.start();
  if (!adapter.isVisible()) app.ticker.stop();
  panel.renderStats({
    fps,
    frameTime,
    fishCount: scene.fishCount,
    width: scene.width,
    height: scene.height,
    resolution: app.renderer.resolution,
    state: '运行中',
  });

  window.addEventListener('beforeunload', () => {
    onResume();
    onPause();
    window.removeEventListener('resize', onResize);
    app.canvas.removeEventListener('pointerdown', onPointerDown);
    panel.destroy();
    scene.destroy();
    void disposeFishTextures(textures, import.meta.env.BASE_URL);
    void Assets.unload(`${import.meta.env.BASE_URL}images/pond-background.png`);
    app.destroy(true);
    adapter.destroy();
  }, { once: true });
}

function showStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : '鱼塘启动失败，请重试。';
  errorElement.textContent = message;
  errorElement.hidden = false;
  console.error(message, error);
}

void startPond().catch(showStartupError);
