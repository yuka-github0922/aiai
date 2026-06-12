export const HOME_WORLD_PROMPT_VERSION = "home_world_v1" as const;
export const HOME_WORLD_GROWTH_PROMPT_VERSION = "home_world_v2_growth" as const;

export const HOME_WORLD_ESTABLISHMENT_THRESHOLD = 3;
export const HOME_WORLD_INPUT_LIMIT = 5;
export const HOME_WORLD_REGROWTH_CONTEXT_LIMIT = 10;
export const HOME_WORLD_REGROWTH_MIN_NEW_ROUNDS = 2;
export const HOME_WORLD_REGROWTH_MIN_HOURS = 24;
export const HOME_WORLD_GENERATION_STALE_MS = 5 * 60 * 1000;

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

export type WorldBible = {
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

export type WorldBibleGrowthResult = {
  worldBible: WorldBible;
  visualChangeNeeded: boolean;
  changeSummary: string;
};

export type CoupleHomeWorldRow = {
  coupleId: string;
  status: CoupleHomeWorldStatus;
  heroImageUrl: string | null;
  heroImageVersion: number;
  worldBible: WorldBible | null;
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
  uiTokens: WorldBible["ui_tokens"] | null;
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
  previousWorldBible: WorldBible;
  previousSourceRoundIds: string[];
  newRounds: HomeWorldQuestionRound[];
  recentRounds: HomeWorldQuestionRound[];
};
