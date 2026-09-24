import type { MyFishPondSettings, QualityMode } from '../types';

export interface DebugPanelCallbacks {
  onQualityChange(mode: QualityMode): void;
  onFishCountChange(count: number): void;
  onPauseToggle(): void;
  onReset(): void;
}

export interface DebugStats {
  fps: number;
  frameTime: number;
  fishCount: number;
  width: number;
  height: number;
  resolution: number;
  state: '运行中' | '已暂停';
}

export class DebugPanel {
  private root: HTMLElement;
  private statsRoot: HTMLElement;
  private pauseButton: HTMLButtonElement;

  constructor(private readonly host: HTMLElement, settings: MyFishPondSettings, callbacks: DebugPanelCallbacks) {
    this.root = document.createElement('aside');
    this.root.className = 'pond-panel';
    this.root.innerHTML = `
      <div class="pond-panel__heading">
        <div class="pond-brand"><span class="pond-brand__mark">✦</span><span><strong>后院鱼塘</strong><small>MyFishPond · Prototype</small></span></div>
        <button class="icon-button" data-action="hide" aria-label="收起控制面板" title="收起面板">⌁</button>
      </div>
      <p class="pond-greeting">欢迎回来，鱼塘主。</p>
      <div class="pond-status"><span class="pond-status__dot"></span><span data-stat="state">运行中</span><span class="pond-status__caption">标准场景</span></div>
      <div class="pond-stats" data-stats></div>
      <div class="pond-control">
        <div class="pond-control__label"><span>性能模式</span><span class="muted">标准 · 30 FPS</span></div>
        <div class="segmented" role="group" aria-label="性能模式">
          <button data-quality="eco">节能</button>
          <button data-quality="standard">标准</button>
          <button data-quality="high">高质量</button>
        </div>
      </div>
      <label class="pond-control pond-slider">
        <span class="pond-control__label"><span>鱼群数量</span><strong data-fish-value>${settings.fishCount} 条</strong></span>
        <input data-fish-count type="range" min="6" max="60" step="1" value="${settings.fishCount}" aria-label="鱼群数量" />
        <span class="slider-limits"><span>6 条</span><span>60 条</span></span>
      </label>
      <div class="pond-actions">
        <button class="action-button action-button--primary" data-action="pause">暂停鱼塘</button>
        <button class="action-button" data-action="reset">恢复推荐设置</button>
      </div>
      <p class="pond-note">原型演示 · 持续轻盈地游动</p>
    `;
    host.appendChild(this.root);
    this.statsRoot = this.root.querySelector('[data-stats]')!;
    this.pauseButton = this.root.querySelector('[data-action="pause"]')!;

    this.root.querySelector<HTMLButtonElement>('[data-action="hide"]')!
      .addEventListener('click', () => this.setVisible(false));
    this.root.querySelector<HTMLButtonElement>('[data-action="reset"]')!
      .addEventListener('click', callbacks.onReset);
    this.pauseButton.addEventListener('click', callbacks.onPauseToggle);
    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => {
      button.addEventListener('click', () => {
        const quality = button.dataset.quality as QualityMode;
        callbacks.onQualityChange(quality);
        this.setQuality(quality);
      });
    });
    this.root.querySelector<HTMLInputElement>('[data-fish-count]')!
      .addEventListener('input', (event) => {
        const value = Number((event.currentTarget as HTMLInputElement).value);
        this.root.querySelector('[data-fish-value]')!.textContent = `${value} 条`;
        callbacks.onFishCountChange(value);
      });
    this.setQuality(settings.qualityMode);
    this.setFishValue(settings.fishCount);
    this.setVisible(false);
  }

  renderStats(stats: DebugStats) {
    this.statsRoot.innerHTML = `
      <div class="stat-card"><strong>${stats.fps.toFixed(0)}</strong><span>FPS</span></div>
      <div class="stat-card"><strong>${stats.frameTime.toFixed(1)}<small>ms</small></strong><span>帧间隔</span></div>
      <div class="stat-card"><strong>${stats.fishCount}</strong><span>游动的鱼</span></div>
      <div class="stat-card"><strong>${stats.width}×${stats.height}</strong><span>逻辑分辨率</span></div>
      <div class="stat-card stat-card--wide"><strong>${stats.resolution.toFixed(2)}×</strong><span>渲染比例 · ${stats.state}</span></div>
    `;
    this.pauseButton.textContent = stats.state === '已暂停' ? '继续鱼塘' : '暂停鱼塘';
  }

  setQuality(mode: QualityMode) {
    this.root.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.quality === mode);
    });
    const label = mode === 'eco' ? '节能 · 20 FPS' : mode === 'high' ? '高质量 · 60 FPS' : '标准 · 30 FPS';
    this.root.querySelector('.pond-control__label .muted')!.textContent = label;
  }

  setFishValue(count: number) {
    const slider = this.root.querySelector<HTMLInputElement>('[data-fish-count]')!;
    slider.value = String(count);
    this.root.querySelector('[data-fish-value]')!.textContent = `${count} 条`;
  }

  setVisible(visible: boolean) {
    this.root.hidden = !visible;
    let toggle = this.host.querySelector<HTMLButtonElement>('.panel-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'panel-toggle';
      toggle.type = 'button';
      toggle.textContent = '鱼塘设置';
      toggle.setAttribute('aria-label', '展开鱼塘设置');
      toggle.addEventListener('click', () => this.setVisible(true));
      this.host.appendChild(toggle);
    }
    toggle.hidden = visible;
    this.root.querySelector<HTMLButtonElement>('[data-action="hide"]')!.disabled = false;
  }

  destroy() {
    this.root.remove();
    this.host.querySelector('.panel-toggle')?.remove();
  }
}
