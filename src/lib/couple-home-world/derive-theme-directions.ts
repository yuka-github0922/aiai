import type {
  BackgroundDirection,
  AccentDirection,
  PaletteHint,
  ThemeDirections,
  WorldIdentity,
} from "@/lib/couple-home-world/types";
import {
  selectBackgroundStructure,
  selectHeroSurroundStructure,
} from "@/lib/couple-home-world/home-theme-structures";

type DeriveDirectionsInput = {
  coupleId: string;
  worldIdentity: WorldIdentity;
  paletteHint: PaletteHint;
  memorySubjects?: string[];
  previous?: ThemeDirections;
  presetShiftNeeded?: boolean;
};

type KeywordWeights = {
  hue: number;
  warmth: number;
  openness: number;
  depth: number;
  texture: number;
};

const KEYWORD_SIGNALS: Array<{ pattern: RegExp; weights: KeywordWeights }> = [
  {
    pattern: /海|水族|波|水|沖縄|旅行|空|泳|ビーチ|sea|ocean|aqua/i,
    weights: { hue: 200, warmth: -0.15, openness: 0.35, depth: -0.1, texture: -0.05 },
  },
  {
    pattern: /ゲーム|ネオン|夜|夜更|都市|サイバ|neon|game|city/i,
    weights: { hue: 270, warmth: -0.25, openness: 0.1, depth: 0.45, texture: -0.1 },
  },
  {
    pattern: /犬|猫|ペット|小春|柴|暮ら|同棲|家|窓|ごはん|生活|pet|home|live/i,
    weights: { hue: 35, warmth: 0.45, openness: 0.15, depth: -0.15, texture: 0.4 },
  },
  {
    pattern: /カフェ|夕| dusk|coffee|未来|結婚|cafe|sunset/i,
    weights: { hue: 25, warmth: 0.35, openness: 0.2, depth: 0.05, texture: 0.25 },
  },
  {
    pattern: /山|森|自然|散歩|forest|mountain|camp/i,
    weights: { hue: 130, warmth: 0.05, openness: 0.25, depth: 0, texture: 0.15 },
  },
  {
    pattern: /桜|春|花|ピクニ|sakura|spring|flower/i,
    weights: { hue: 340, warmth: 0.25, openness: 0.3, depth: -0.1, texture: 0.1 },
  },
  {
    pattern: /焼肉|食|ごはん|カフェ|food|eat|yakiniku/i,
    weights: { hue: 18, warmth: 0.35, openness: 0.05, depth: -0.05, texture: 0.2 },
  },
];

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hashUnit(seed: string, salt: string): number {
  const h = stableHash(`${seed}:${salt}`);
  return (h % 10000) / 10000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function paletteHintBias(hint: PaletteHint): Partial<BackgroundDirection & AccentDirection> {
  const warmth =
    hint.temperature === "warm" ? 0.35 : hint.temperature === "cool" ? -0.35 : 0;
  const lightness =
    hint.brightness === "light" ? 78 : hint.brightness === "dark" ? 42 : 62;
  const saturation = hint.saturation === "vivid" ? 72 : 48;

  return {
    warmth,
    lightness,
    saturation,
    depth: hint.brightness === "dark" ? 0.35 : hint.brightness === "light" ? 0.08 : 0.18,
  };
}

function collectCorpus(input: DeriveDirectionsInput): string {
  const { worldIdentity, memorySubjects = [] } = input;
  return [
    worldIdentity.phrase,
    worldIdentity.mood,
    ...worldIdentity.sensory,
    ...worldIdentity.anchors,
    ...memorySubjects,
  ].join(" ");
}

function keywordVector(corpus: string): KeywordWeights {
  const totals: KeywordWeights = { hue: 0, warmth: 0, openness: 0, depth: 0, texture: 0 };
  let hits = 0;

  for (const { pattern, weights } of KEYWORD_SIGNALS) {
    if (pattern.test(corpus)) {
      totals.hue += weights.hue;
      totals.warmth += weights.warmth;
      totals.openness += weights.openness;
      totals.depth += weights.depth;
      totals.texture += weights.texture;
      hits += 1;
    }
  }

  if (hits === 0) {
    return { hue: 350, warmth: 0.25, openness: 0.35, depth: 0.1, texture: 0.1 };
  }

  return {
    hue: totals.hue / hits,
    warmth: totals.warmth / hits,
    openness: totals.openness / hits,
    depth: totals.depth / hits,
    texture: totals.texture / hits,
  };
}

function microAdjust(coupleId: string, phrase: string): KeywordWeights {
  return {
    hue: (hashUnit(coupleId, phrase) - 0.5) * 24,
    warmth: (hashUnit(coupleId, `${phrase}:w`) - 0.5) * 0.18,
    openness: (hashUnit(coupleId, `${phrase}:o`) - 0.5) * 0.14,
    depth: (hashUnit(coupleId, `${phrase}:d`) - 0.5) * 0.12,
    texture: (hashUnit(coupleId, `${phrase}:t`) - 0.5) * 0.1,
  };
}

function buildBackgroundDirection(
  input: DeriveDirectionsInput,
  vector: KeywordWeights,
  micro: KeywordWeights,
  hintBias: ReturnType<typeof paletteHintBias>
): BackgroundDirection {
  const hueBase = vector.hue + micro.hue + (hintBias.warmth ?? 0) * 8;

  return {
    hue_base: ((hueBase % 360) + 360) % 360,
    hue_spread: clamp(18 + vector.openness * 20 + micro.openness * 10, 12, 48),
    lightness: clamp((hintBias.lightness ?? 62) + micro.openness * 6, 38, 88),
    warmth: clamp(vector.warmth + micro.warmth + (hintBias.warmth ?? 0), -1, 1),
    openness: clamp(vector.openness + micro.openness, 0, 1),
    depth: clamp(vector.depth + micro.depth + (hintBias.depth ?? 0), 0, 1),
    texture: clamp(vector.texture + micro.texture, 0, 1),
    grid_opacity: clamp(0.04 + vector.texture * 0.06, 0.02, 0.12),
  };
}

function buildAccentDirection(
  background: BackgroundDirection,
  hintBias: ReturnType<typeof paletteHintBias>
): AccentDirection {
  const accentHue = (background.hue_base + 28 + background.warmth * 18 + 360) % 360;

  return {
    hue: accentHue,
    saturation: clamp(hintBias.saturation ?? 55, 35, 85),
    lightness: clamp(background.lightness - 8 + background.warmth * 6, 35, 72),
    contrast: clamp(0.35 + background.depth * 0.35, 0.25, 0.85),
    softness: clamp(0.55 + background.texture * 0.25 - background.depth * 0.15, 0.2, 0.95),
  };
}

function lerpDirection(
  previous: ThemeDirections,
  next: ThemeDirections,
  input: DeriveDirectionsInput
): ThemeDirections {
  const bg = next.background;
  const ac = next.accent;
  const pbg = previous.background;
  const pac = previous.accent;

  const lerpBg: BackgroundDirection = {
    hue_base: lerpHue(pbg.hue_base, bg.hue_base, 0.35),
    hue_spread: lerp(pbg.hue_spread, bg.hue_spread, 0.25),
    lightness: lerp(pbg.lightness, bg.lightness, 0.2),
    warmth: lerp(pbg.warmth, bg.warmth, 0.25),
    openness: lerp(pbg.openness, bg.openness, 0.2),
    depth: lerp(pbg.depth, bg.depth, 0.2),
    texture: lerp(pbg.texture, bg.texture, 0.2),
    grid_opacity: lerp(pbg.grid_opacity, bg.grid_opacity, 0.2),
  };

  const lerpAc: AccentDirection = {
    hue: lerpHue(pac.hue, ac.hue, 0.3),
    saturation: lerp(pac.saturation, ac.saturation, 0.25),
    lightness: lerp(pac.lightness, ac.lightness, 0.2),
    contrast: lerp(pac.contrast, ac.contrast, 0.2),
    softness: lerp(pac.softness, ac.softness, 0.2),
  };

  let skeleton = previous.skeleton;
  if (input.presetShiftNeeded) {
    skeleton = {
      layout: "arch_window_v1",
      hero_frame: "arch",
      label_shape: "sticker",
      background_structure: selectBackgroundStructure(lerpBg),
      hero_surround_structure: selectHeroSurroundStructure(lerpBg, lerpAc),
    };
  }

  return {
    background: lerpBg,
    accent: lerpAc,
    skeleton,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHue(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

export function deriveThemeDirections(input: DeriveDirectionsInput): ThemeDirections {
  const corpus = collectCorpus(input);
  const vector = keywordVector(corpus);
  const micro = microAdjust(input.coupleId, input.worldIdentity.phrase);
  const hintBias = paletteHintBias(input.paletteHint);

  const background = buildBackgroundDirection(input, vector, micro, hintBias);
  const accent = buildAccentDirection(background, hintBias);

  let directions: ThemeDirections = {
    background,
    accent,
    skeleton: {
      layout: "arch_window_v1",
      hero_frame: "arch",
      label_shape: "sticker",
      background_structure: selectBackgroundStructure(background),
      hero_surround_structure: selectHeroSurroundStructure(background, accent),
    },
  };

  if (input.previous && !input.presetShiftNeeded) {
    directions = lerpDirection(input.previous, directions, input);
  } else if (input.previous && input.presetShiftNeeded) {
    directions = lerpDirection(input.previous, directions, {
      ...input,
      presetShiftNeeded: true,
    });
  }

  return directions;
}
