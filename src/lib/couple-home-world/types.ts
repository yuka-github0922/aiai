import type { HomeThemeCssVars } from "@/lib/couple-home-world/home-theme-css-vars";

export const HOME_WORLD_PROMPT_VERSION = "home_world_v1" as const;
export const HOME_WORLD_GROWTH_PROMPT_VERSION = "home_world_v2_growth" as const;
export const HOME_WORLD_V3_IDENTITY_PROMPT_VERSION = "home_world_v3_identity" as const;
export const HOME_WORLD_V3_GROWTH_PROMPT_VERSION = "home_world_v3_growth" as const;

export const HOME_WORLD_ESTABLISHMENT_THRESHOLD = 3;
export const HOME_WORLD_INPUT_LIMIT = 5;
export const HOME_WORLD_REGROWTH_CONTEXT_LIMIT = 10;
export const HOME_WORLD_REGROWTH_MIN_NEW_ROUNDS = 2;
export const HOME_WORLD_REGROWTH_MIN_HOURS = 24;
export const HOME_WORLD_GENERATION_STALE_MS = 5 * 60 * 1000;

export const HOME_THEME_MATCHER_VERSION = "home_theme_v3c_expression" as const;
export const EXPRESSION_MATCHER_VERSION = "expression_v1" as const;

export type ExpressionDensity = "airy" | "balanced" | "compact";
export type ExpressionMaterial = "glass" | "paper" | "panel" | "soft";
export type ExpressionTypography = "serif" | "sans" | "mono" | "hand";
export type ExpressionHeading = "minimal" | "rule" | "badge" | "tape";

export type ExpressionTokens = {
  density: ExpressionDensity;
  material: ExpressionMaterial;
  typography: ExpressionTypography;
  heading: ExpressionHeading;
  matcher_version: typeof EXPRESSION_MATCHER_VERSION;
};

/** @deprecated Phase 3c — use ExpressionTokens.material */
export type SkinFamilyId =
  | "ocean_voyage"
  | "neon_arcade"
  | "cozy_journal"
  | "soft_default";

/** @deprecated Phase 3c — use ExpressionTokens.density */
export type TraitRowStyleId = "soft" | "journal" | "airy" | "compact";

export type CoupleHomeWorldStatus =
  | "pending"
  | "generating"
  | "ready"
  | "failed";

export type WorldBibleEmbeddedMemory = {
  subject: string;
  how_it_appears: string;
  prominence: "noticed_first" | "noticed_second" | "subtle";
};

export type WorldIdentity = {
  phrase: string;
  mood: string;
  sensory: string[];
  anchors: string[];
};

export type PaletteHint = {
  temperature: "warm" | "cool" | "neutral";
  brightness: "light" | "medium" | "dark";
  saturation: "soft" | "vivid";
};

export type WorldScene = {
  mood_summary: string;
  atmosphere: string;
  composition: string;
  embedded_memories: WorldBibleEmbeddedMemory[];
  scene_prompt: string;
};

export type BackgroundDirection = {
  hue_base: number;
  hue_spread: number;
  lightness: number;
  warmth: number;
  openness: number;
  depth: number;
  texture: number;
  grid_opacity: number;
};

export type AccentDirection = {
  hue: number;
  saturation: number;
  lightness: number;
  contrast: number;
  softness: number;
};

export type BackgroundStructureId =
  | "grid_gradient"
  | "plain_gradient"
  | "paper_grid"
  | "dark_glow"
  | "soft_wash";

export type HeroSurroundStructureId =
  | "arch_flat"
  | "arch_inner_glow"
  | "arch_glass"
  | "arch_tinted";

export type SkeletonRef = {
  layout: "arch_window_v1";
  hero_frame: "arch";
  label_shape: "sticker";
  background_structure: BackgroundStructureId;
  hero_surround_structure: HeroSurroundStructureId;
};

export type ThemeDirections = {
  background: BackgroundDirection;
  accent: AccentDirection;
  skeleton: SkeletonRef;
};

export type HomeThemePalette = {
  primary: string;
  secondary: string;
  accent: string;
  sky: string;
  ground: string;
  surface: string;
  text_muted: string;
};

export type HomeThemeAccentTokens = {
  heart: string;
  subtitle: string;
  label_bg: string;
  label_text: string;
  num: string;
  num_shadow: string;
  num_label: string;
  marker_highlight: string;
  anniversary_accent: string;
  body: string;
};

export type HomeTheme = {
  derived_at: string;
  matcher_version: string;
  directions: ThemeDirections;
  expression?: ExpressionTokens;
  /** @deprecated read-time backfill only */
  skin_family?: SkinFamilyId;
  /** @deprecated read-time backfill only */
  trait_row_style?: TraitRowStyleId;
  palette: HomeThemePalette;
  accent_tokens: HomeThemeAccentTokens;
  css_vars: HomeThemeCssVars;
};

export type WorldBibleFlags = {
  identity_evolved?: boolean;
  visual_change_needed?: boolean;
  ui_change_needed?: boolean;
  preset_shift_needed?: boolean;
  change_summary?: string;
};

export type AiWorldBibleOutput = {
  world_identity: WorldIdentity;
  palette_hint: PaletteHint;
  scene: WorldScene;
};

export type WorldBibleV3 = AiWorldBibleOutput & {
  prompt_version:
    | typeof HOME_WORLD_V3_IDENTITY_PROMPT_VERSION
    | typeof HOME_WORLD_V3_GROWTH_PROMPT_VERSION;
  home_theme: HomeTheme;
} & WorldBibleFlags;

/** @deprecated v1/v2 flat shape — read via parseWorldBible */
export type WorldBibleLegacy = {
  prompt_version:
    | typeof HOME_WORLD_PROMPT_VERSION
    | typeof HOME_WORLD_GROWTH_PROMPT_VERSION;
  mood_summary: string;
  atmosphere: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    sky: string;
    ground: string;
  };
  typography_mood: string;
  composition: string;
  embedded_memories: WorldBibleEmbeddedMemory[];
  scene_prompt: string;
  ui_tokens: {
    heart_color: string;
    subtitle_color: string;
  };
};

export type WorldBibleStored = WorldBibleV3 | WorldBibleLegacy;

export type ParsedWorldBible = {
  version: "v3" | "legacy";
  stored: WorldBibleStored;
  worldIdentity: WorldIdentity | null;
  paletteHint: PaletteHint | null;
  scene: WorldScene;
  homeTheme: HomeTheme | null;
  flags: WorldBibleFlags;
};

export type WorldBibleGrowthResult = {
  output: AiWorldBibleOutput;
  flags: Required<
    Pick<
      WorldBibleFlags,
      | "identity_evolved"
      | "visual_change_needed"
      | "ui_change_needed"
      | "preset_shift_needed"
      | "change_summary"
    >
  >;
};

export type CoupleHomeWorldRow = {
  coupleId: string;
  status: CoupleHomeWorldStatus;
  heroImageUrl: string | null;
  heroImageVersion: number;
  worldBible: ParsedWorldBible | null;
  sourceRoundIds: string[];
  sourceRevealedCount: number;
  generationPhase: number;
  generatedAt: string | null;
  lastRegenerationAt: string | null;
  updatedAt: string | null;
};

export type CoupleHomeSceneState = "nascent" | "establishing" | "ready";

export type CoupleHomeWorldDisplay = {
  sceneState: CoupleHomeSceneState;
  heroImageUrl: string | null;
  phrase: string | null;
  homeThemeCssVars: HomeThemeCssVars | null;
  expression: ExpressionTokens | null;
  revealedCount: number;
  shouldRegrow: boolean;
};

export type HomeWorldQuestionRound = {
  roundId: string;
  question: string;
  answers: Array<{ name: string; answer: string }>;
};

export type HomeWorldGenerationInput = {
  revealedCount: number;
  rounds: HomeWorldQuestionRound[];
};

export type HomeWorldRegrowthInput = {
  revealedCount: number;
  previousWorldBible: ParsedWorldBible;
  previousSourceRoundIds: string[];
  newRounds: HomeWorldQuestionRound[];
  recentRounds: HomeWorldQuestionRound[];
};

/** @deprecated use ParsedWorldBible */
export type WorldBible = WorldBibleLegacy;
