import { AnimatedSprite, Container, Graphics, Mesh, MeshPlane, Rectangle, Sprite, type Renderer, type Texture } from 'pixi.js';
import { drawFishMarkings, type FishDefinition } from './FishPattern';

const COLUMNS = 17;
const ROWS = 5;

/** Bake the portable markings once; deform skin, markings and shadow on the same spine. */
export class FishVisual {
  readonly root = new Container();
  readonly animation: AnimatedSprite;
  readonly shadow: Mesh;
  private readonly body: MeshPlane;
  private readonly frames: Texture[];

  constructor(
    renderer: Renderer, definition: FishDefinition, textures: Texture[],
    private readonly length: number, animationSpeed: number, initialFrame: number,
  ) {
    const height = length * textures[0]!.height / textures[0]!.width;
    const source = new Container();
    const skin = new Sprite({ texture: textures[0], anchor: 0.5 });
    skin.width = length;
    skin.height = height;
    skin.tint = definition.appearance.tint;
    const markings = new Graphics();
    drawFishMarkings(markings, definition.appearance, length, height);
    // Retain the scales and highlights under each individual marking.
    markings.alpha = 0.62;
    source.addChild(skin, markings);
    this.frames = textures.map((texture) => {
      skin.texture = texture;
      skin.width = length;
      skin.height = height;
      return renderer.generateTexture({
        target: source,
        frame: new Rectangle(-length / 2, -height / 2, length, height),
        resolution: 2,
        antialias: true,
      });
    });
    source.destroy({ children: true });
    this.animation = new AnimatedSprite({ textures: this.frames, animationSpeed, autoUpdate: false });
    this.animation.gotoAndPlay(initialFrame);
    this.body = new MeshPlane({ texture: this.animation.texture, verticesX: COLUMNS, verticesY: ROWS });
    this.body.autoResize = false;
    this.shadow = new Mesh({ geometry: this.body.geometry, texture: this.animation.texture });
    this.shadow.tint = 0x082f32;
    this.root.addChild(this.body);
    this.update(0, 0, 1, 0.4);
  }

  update(phase: number, turn: number, speedRatio: number, depth: number) {
    const height = this.length * this.frames[0]!.height / this.frames[0]!.width;
    const buffer = this.body.geometry.getAttribute('aPosition').buffer;
    const positions = buffer.data as Float32Array;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        const u = column / (COLUMNS - 1);
        const v = row / (ROWS - 1) - 0.5;
        const tail = 1 - u;
        // The head leads. Wave amplitude grows towards the flexible tail.
        const bend = Math.sin(phase - tail * 4.2) * tail ** 2.5
          * this.length * (0.025 + Math.min(1.7, speedRatio) * 0.019);
        const turning = -turn * this.length * 0.075 * tail * tail;
        const fin = 1 + Math.sin(phase * 1.8 + u * 5) * 0.045 * Math.sin(u * Math.PI);
        const index = (row * COLUMNS + column) * 2;
        positions[index] = (u - 0.5) * this.length;
        positions[index + 1] = v * height * fin + bend + turning;
      }
    }
    buffer.update();
    this.body.texture = this.animation.texture;
    this.shadow.texture = this.animation.texture;
    const scale = 1 - depth * 0.085;
    this.root.scale.set(scale);
    this.shadow.scale.set(scale * 0.96);
    this.body.tint = [0.98 - depth * 0.19, 0.99 - depth * 0.065, 0.98 - depth * 0.035];
    this.root.alpha = 0.97 - depth * 0.13;
    this.shadow.alpha = 0.12 + depth * 0.07;
  }

  destroy() {
    const geometry = this.body.geometry;
    this.root.destroy({ children: true });
    this.shadow.destroy();
    this.animation.destroy();
    geometry.destroy();
    for (const frame of this.frames) frame.destroy(true);
  }
}
