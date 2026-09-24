import { Assets, Rectangle, Texture } from 'pixi.js';
import type { FishSpecies } from '../fish/FishEntity';

export type FishTextureSet = Record<FishSpecies, Texture[]>;

export async function loadFishTextures(baseUrl: string): Promise<FishTextureSet> {
  const [koi, goldfish] = await Promise.all([
    Assets.load<Texture>(`${baseUrl}images/koi-swim-sheet-v2.png`),
    Assets.load<Texture>(`${baseUrl}images/goldfish-swim-sheet-v2.png`),
  ]);
  return {
    koi: createAnimationFrames(koi),
    goldfish: createAnimationFrames(goldfish),
  };
}

export async function disposeFishTextures(textures: FishTextureSet, baseUrl: string) {
  for (const texture of new Set(Object.values(textures).flat())) texture.destroy(false);
  await Assets.unload([
    `${baseUrl}images/koi-swim-sheet-v2.png`,
    `${baseUrl}images/goldfish-swim-sheet-v2.png`,
  ]);
}

function createAnimationFrames(sheet: Texture): Texture[] {
  const columns = 3;
  const rows = 3;
  const frameCount = 8;
  return Array.from({ length: frameCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.round((column * sheet.width) / columns);
    const top = Math.round((row * sheet.height) / rows);
    const right = Math.round(((column + 1) * sheet.width) / columns);
    const bottom = Math.round(((row + 1) * sheet.height) / rows);
    return new Texture({
      source: sheet.source,
      frame: new Rectangle(left, top, right - left, bottom - top),
    });
  });
}
