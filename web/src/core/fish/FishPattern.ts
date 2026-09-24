import type { FishSpecies } from './FishEntity';

export type FishPatternId = 'kohaku' | 'sanke' | 'bekko' | 'tancho' | 'calico' | 'sakura' | 'gold-white';

export interface FishMarking {
  /** Position along the body from tail root (0) to head (1). */
  x: number;
  /** Position across the body, from -1 (upper side) to 1 (lower side). */
  y: number;
  /** Radius as a fraction of the body half-length and half-width. */
  rx: number;
  ry: number;
  color: number;
  alpha: number;
}

export interface FishAppearance {
  generatorVersion: 1;
  seed: number;
  pattern: FishPatternId;
  /** Tint keeps the source illustration intact while giving each fish its own base tone. */
  tint: number;
  markings: FishMarking[];
}

export interface FishDefinition {
  format: 'myfishpond.fish';
  version: 1;
  id: string;
  name: string;
  species: FishSpecies;
  appearance: FishAppearance;
}

export type RequestedFishPattern = FishPatternId | 'auto';

const KOI_PATTERNS: FishPatternId[] = ['kohaku', 'sanke', 'bekko', 'tancho'];
const GOLDFISH_PATTERNS: FishPatternId[] = ['calico', 'sakura', 'gold-white'];

const KOI_TINTS = [0xffffff, 0xfffaf2, 0xfff4e9, 0xf6f8ff];
const GOLDFISH_TINTS = [0xffffff, 0xfff1d6, 0xffddad, 0xffe7d3];

const COLORS = {
  vermilion: [0xe25338, 0xd94b34, 0xc94a36, 0xe56d42],
  sumi: [0x242c31, 0x343b3d, 0x1d2429],
  cream: [0xfff6e9, 0xffeed7, 0xf8f4e8],
};

/** Generate a complete, portable fish appearance. Passing a concrete pattern makes generation reproducible and user-directed. */
export function createFishDefinition(
  species: FishSpecies,
  seed: number,
  requestedPattern: RequestedFishPattern = 'auto',
  name?: string,
): FishDefinition {
  const normalizedSeed = seed >>> 0;
  const random = seededRandom(normalizedSeed);
  const choices = species === 'koi' ? KOI_PATTERNS : GOLDFISH_PATTERNS;
  const pattern = requestedPattern === 'auto'
    ? choices[Math.floor(random() * choices.length)]
    : requestedPattern;
  if (!choices.includes(pattern)) {
    throw new Error(`花型 ${pattern} 不适用于${species === 'koi' ? '锦鲤' : '金鱼'}。`);
  }

  const appearance: FishAppearance = {
    generatorVersion: 1,
    seed: normalizedSeed,
    pattern,
    tint: pick(random, species === 'koi' ? KOI_TINTS : GOLDFISH_TINTS),
    markings: generateMarkings(species, pattern, random),
  };

  return {
    format: 'myfishpond.fish',
    version: 1,
    id: `${species}-${normalizedSeed.toString(16).padStart(8, '0')}`,
    name: name?.trim() || `${species === 'koi' ? '锦鲤' : '金鱼'}-${normalizedSeed.toString(16).slice(-4)}`,
    species,
    appearance,
  };
}

export function serializeFishFile(fish: FishDefinition): string {
  return `${JSON.stringify(fish, null, 2)}\n`;
}

/** Parse and validate a shared .mfp-fish.json file before it enters the scene. */
export function parseFishFile(content: string): FishDefinition {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error('鱼文件不是有效的 JSON。');
  }
  if (!isRecord(value) || value.format !== 'myfishpond.fish' || value.version !== 1) {
    throw new Error('无法识别鱼文件格式或版本。');
  }
  const { id, name, species, appearance } = value;
  if (typeof id !== 'string' || id.length > 100 || typeof name !== 'string' || name.length > 60) {
    throw new Error('鱼文件中的名称或编号无效。');
  }
  if (species !== 'koi' && species !== 'goldfish') throw new Error('鱼文件包含不支持的鱼种。');
  if (!isRecord(appearance) || appearance.generatorVersion !== 1) {
    throw new Error('鱼文件中的花纹生成器版本不受支持。');
  }

  const validPatterns = species === 'koi' ? KOI_PATTERNS : GOLDFISH_PATTERNS;
  if (!validPatterns.includes(appearance.pattern as FishPatternId)) throw new Error('鱼文件中的花型与鱼种不匹配。');
  if (!isUint32(appearance.seed) || !isColor(appearance.tint) || !Array.isArray(appearance.markings)) {
    throw new Error('鱼文件中的外观参数无效。');
  }
  if (appearance.markings.length > 24) throw new Error('一条鱼最多可包含 24 个花纹色块。');

  const markings = appearance.markings.map((marking) => {
    if (!isRecord(marking) || !isFiniteBetween(marking.x, 0, 1) || !isFiniteBetween(marking.y, -1, 1)
      || !isFiniteBetween(marking.rx, 0.025, 0.45) || !isFiniteBetween(marking.ry, 0.08, 0.95)
      || !isColor(marking.color) || !isFiniteBetween(marking.alpha, 0, 1)) {
      throw new Error('鱼文件包含超出范围的花纹坐标或颜色。');
    }
    return {
      x: marking.x,
      y: marking.y,
      rx: marking.rx,
      ry: marking.ry,
      color: marking.color,
      alpha: marking.alpha,
    };
  });

  return {
    format: 'myfishpond.fish',
    version: 1,
    id,
    name,
    species,
    appearance: {
      generatorVersion: 1,
      seed: appearance.seed,
      pattern: appearance.pattern as FishPatternId,
      tint: appearance.tint,
      markings,
    },
  };
}

export async function readFishFile(file: File): Promise<FishDefinition> {
  return parseFishFile(await file.text());
}

export function downloadFishFile(fish: FishDefinition) {
  const blob = new Blob([serializeFishFile(fish)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(fish.name)}.mfp-fish.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function drawFishMarkings(
  graphics: import('pixi.js').Graphics,
  appearance: FishAppearance,
  fishWidth: number,
  fishHeight: number,
) {
  const bodyStartX = -fishWidth * 0.22;
  const bodyLength = fishWidth * 0.6;
  const bodyHalfLength = fishWidth * 0.3;
  const bodyHalfWidth = fishHeight * 0.43;

  for (const marking of appearance.markings) {
    const centerX = bodyStartX + marking.x * bodyLength;
    const centerY = marking.y * bodyHalfWidth * 0.58;
    const radiusX = marking.rx * bodyHalfLength;
    const radiusY = marking.ry * bodyHalfWidth * 0.48;
    const pointCount = 12;
    const points: Array<{ x: number; y: number }> = [];
    const random = seededRandom(appearance.seed ^ Math.round(marking.x * 10_000) ^ Math.round(marking.y * 1_000));
    const phase = random() * Math.PI * 2;

    for (let index = 0; index < pointCount; index += 1) {
      const angle = (index / pointCount) * Math.PI * 2;
      const ripple = 0.83 + random() * 0.28 + Math.sin(angle * 3 + phase) * 0.05;
      points.push({
        x: centerX + Math.cos(angle) * radiusX * ripple,
        y: centerY + Math.sin(angle) * radiusY * ripple,
      });
    }
    const first = points[0]!;
    const last = points[pointCount - 1]!;
    graphics.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let index = 0; index < pointCount; index += 1) {
      const current = points[index]!;
      const next = points[(index + 1) % pointCount]!;
      graphics.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    graphics.closePath().fill({ color: marking.color, alpha: marking.alpha });
  }
}

function generateMarkings(species: FishSpecies, pattern: FishPatternId, random: () => number): FishMarking[] {
  const markings: FishMarking[] = [];
  if (species === 'koi') {
    if (pattern === 'tancho') {
      markings.push(makeMark(0.9 + random() * 0.035, (random() - 0.5) * 0.18, 0.14, 0.56, pick(random, COLORS.vermilion), random));
      if (random() > 0.6) markings.push(makeMark(0.48 + random() * 0.12, (random() - 0.5) * 0.6, 0.055, 0.25, pick(random, COLORS.sumi), random));
      return markings;
    }

    const redCount = pattern === 'bekko' ? 0 : 2 + Math.floor(random() * 3);
    const blackCount = pattern === 'kohaku' ? 0 : pattern === 'bekko' ? 3 + Math.floor(random() * 2) : 1 + Math.floor(random() * 2);
    addDistributedMarks(markings, redCount, COLORS.vermilion, random, 0.13, 0.83, 0.78);
    addDistributedMarks(markings, blackCount, COLORS.sumi, random, 0.17, 0.85, 0.5);
    return markings;
  }

  if (pattern === 'gold-white') {
    addDistributedMarks(markings, 3 + Math.floor(random() * 2), COLORS.cream, random, 0.1, 0.88, 0.76);
  } else if (pattern === 'sakura') {
    addDistributedMarks(markings, 2 + Math.floor(random() * 2), COLORS.cream, random, 0.1, 0.88, 0.72);
    addDistributedMarks(markings, 1 + Math.floor(random() * 2), COLORS.vermilion, random, 0.18, 0.78, 0.62);
  } else {
    addDistributedMarks(markings, 2 + Math.floor(random() * 2), COLORS.cream, random, 0.08, 0.9, 0.74);
    addDistributedMarks(markings, 2 + Math.floor(random() * 2), COLORS.sumi, random, 0.18, 0.86, 0.55);
  }
  return markings;
}

function addDistributedMarks(
  markings: FishMarking[],
  count: number,
  colors: number[],
  random: () => number,
  start: number,
  end: number,
  alpha: number,
) {
  for (let index = 0; index < count; index += 1) {
    const lane = (index + 0.5 + (random() - 0.5) * 0.5) / count;
    const x = start + lane * (end - start);
    const y = (random() - 0.5) * 1.05;
    const rx = 0.14 + random() * 0.13;
    const ry = 0.28 + random() * 0.36;
    markings.push(makeMark(x, y, rx, ry, pick(random, colors), random, alpha));
  }
}

function makeMark(
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  random: () => number,
  alpha = 0.78 + random() * 0.18,
): FishMarking {
  return {
    x: clamp(x, 0.04, 0.98),
    y: clamp(y, -0.72, 0.72),
    rx,
    ry,
    color,
    alpha,
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

function isColor(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

function isFiniteBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function safeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60) || 'fish';
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
