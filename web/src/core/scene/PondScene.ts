import { BlurFilter, Container, Rectangle, Sprite, type Renderer, type Texture } from 'pixi.js';
import { FishEntity } from '../fish/FishEntity';
import { PondWaterSurface } from '../water/PondWaterSurface';
import { createFishDefinition } from '../fish/FishPattern';
import type { QualityProfile } from '../../config/defaults';
import type { FishTextureSet } from './fishTextures';

export class PondScene {
  readonly stage = new Container();
  readonly staticLayer = new Container();
  readonly decorLayer = new Container();
  readonly fishLayer = new Container();
  readonly shadowLayer = new Container();
  readonly fxLayer = new Container();
  private readonly water: PondWaterSurface;
  private readonly shadowBlur = new BlurFilter({ strength: 2.4, quality: 2, resolution: 0.5 });
  private background: Sprite;
  private fish: FishEntity[] = [];
  private seed = 31_415;
  width = 1;
  height = 1;

  constructor(
    private readonly renderer: Renderer,
    private readonly textures: FishTextureSet,
    backgroundTexture: Texture,
  ) {
    this.water = new PondWaterSurface(backgroundTexture);
    this.background = new Sprite(backgroundTexture);
    this.background.anchor.set(0.5);
    this.staticLayer.addChild(this.background);
    this.shadowLayer.filters = [this.shadowBlur];
    this.fishLayer.sortableChildren = true;
    this.stage.addChild(this.staticLayer, this.decorLayer, this.shadowLayer, this.fishLayer, this.fxLayer);
    this.stage.filters = [this.water.filter];
  }

  get fishCount() {
    return this.fish.length;
  }

  get fishEntities() {
    return this.fish;
  }

  get random() {
    return () => this.nextRandom();
  }

  resize(width: number, height: number) {
    this.water.releaseInput();
    this.width = width;
    this.height = height;
    const scale = Math.max(width / this.background.texture.width, height / this.background.texture.height);
    this.background.width = this.background.texture.width * scale;
    this.background.height = this.background.texture.height * scale;
    this.background.position.set(width / 2, height / 2);
    this.stage.filterArea = new Rectangle(0, 0, width, height);
    this.shadowLayer.filterArea = new Rectangle(0, 0, width, height);
    this.water.resize(width, height);
  }

  setFishCount(count: number) {
    while (this.fish.length < count) this.addFish();
    while (this.fish.length > count) {
      const removed = this.fish.pop();
      if (removed) {
        this.fishLayer.removeChild(removed.sprite);
        this.shadowLayer.removeChild(removed.shadow);
        removed.destroy();
      }
    }
  }

  applyProfile(profile: QualityProfile, devicePixelRatio: number) {
    this.water.releaseInput();
    this.renderer.resolution = Math.max(0.5, Math.min(1.5, devicePixelRatio * profile.renderScale));
    this.renderer.resize(this.width, this.height);
    this.water.setQuality(profile);
    this.shadowBlur.enabled = profile.shaderQuality !== 'off';
    this.shadowLayer.alpha = profile.shaderQuality === 'off' ? 0.6 : 1;
  }

  updateWater(deltaMs: number, motionEnabled: boolean, causticsEnabled: boolean) {
    this.water.update(deltaMs, motionEnabled, causticsEnabled, this.fish);
  }

  addWaterRipple(x: number, y: number) {
    this.water.addRipple(x, y);
  }

  destroy() {
    for (const fish of this.fish) {
      this.fishLayer.removeChild(fish.sprite);
      this.shadowLayer.removeChild(fish.shadow);
      fish.destroy();
    }
    this.fish = [];
    this.stage.filters = null;
    this.water.destroy();
    this.shadowLayer.filters = null;
    this.shadowBlur.blurXFilter.destroy();
    this.shadowBlur.blurYFilter.destroy();
    this.shadowBlur.destroy();
    this.stage.destroy({ children: true });
  }

  private addFish() {
    const species = this.nextRandom() > 0.42 ? 'koi' : 'goldfish';
    const sizeScale = 0.62 + this.nextRandom() * 0.55;
    const patternSeed = Math.floor(this.nextRandom() * 4_294_967_296) >>> 0;
    const definition = createFishDefinition(species, patternSeed);
    const fish = new FishEntity(definition, this.textures[species], this.random, sizeScale, this.renderer);
    const safeWidth = Math.max(1, this.width);
    const safeHeight = Math.max(1, this.height);
    fish.x = safeWidth * (0.12 + this.nextRandom() * 0.76);
    fish.y = safeHeight * (0.12 + this.nextRandom() * 0.76);
    fish.sprite.position.set(fish.x, fish.y);
    fish.shadow.position.set(fish.x + 7, fish.y + 12);
    this.fish.push(fish);
    this.fishLayer.addChild(fish.sprite);
    this.shadowLayer.addChild(fish.shadow);
  }

  private nextRandom() {
    this.seed = (this.seed * 1_664_525 + 1_013_904_223) >>> 0;
    return this.seed / 4_294_967_296;
  }
}
