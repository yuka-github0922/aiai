import { deriveThemeDirections } from "@/lib/couple-home-world/derive-theme-directions";
import { synthesizeHomeTheme } from "@/lib/couple-home-world/synthesize-home-theme";
import type {
  AiWorldBibleOutput,
  HomeTheme,
  PaletteHint,
  ThemeDirections,
  WorldBibleLegacy,
  WorldIdentity,
} from "@/lib/couple-home-world/types";

export type DeriveHomeThemeInput = {
  coupleId: string;
  worldIdentity: WorldIdentity;
  paletteHint: PaletteHint;
  memorySubjects?: string[];
  previousDirections?: ThemeDirections;
  presetShiftNeeded?: boolean;
};

export function deriveHomeTheme(input: DeriveHomeThemeInput): HomeTheme {
  const directions = deriveThemeDirections({
    coupleId: input.coupleId,
    worldIdentity: input.worldIdentity,
    paletteHint: input.paletteHint,
    memorySubjects: input.memorySubjects,
    previous: input.previousDirections,
    presetShiftNeeded: input.presetShiftNeeded,
  });

  return synthesizeHomeTheme(directions);
}

export function buildWorldBibleV3Document(
  ai: AiWorldBibleOutput,
  homeTheme: HomeTheme,
  promptVersion:
    | "home_world_v3_identity"
    | "home_world_v3_growth",
  flags?: {
    identity_evolved?: boolean;
    visual_change_needed?: boolean;
    ui_change_needed?: boolean;
    preset_shift_needed?: boolean;
    change_summary?: string;
  }
) {
  return {
    prompt_version: promptVersion,
    world_identity: ai.world_identity,
    palette_hint: ai.palette_hint,
    scene: ai.scene,
    home_theme: homeTheme,
    ...flags,
  };
}

export function deriveHomeThemeFromLegacy(
  coupleId: string,
  legacy: WorldBibleLegacy
): HomeTheme {
  const worldIdentity: WorldIdentity = {
    phrase: legacy.mood_summary,
    mood: legacy.atmosphere,
    sensory: legacy.embedded_memories.map((m) => m.subject),
    anchors: legacy.embedded_memories.map((m) => m.how_it_appears).slice(0, 4),
  };

  const warmth = legacy.palette.primary.includes("f") ? 0.3 : 0.1;

  return deriveHomeTheme({
    coupleId,
    worldIdentity,
    paletteHint: {
      temperature: warmth > 0.2 ? "warm" : "neutral",
      brightness: "light",
      saturation: "soft",
    },
    memorySubjects: legacy.embedded_memories.map((m) => m.subject),
  });
}

export function attachHomeThemeToAiOutput(
  coupleId: string,
  ai: AiWorldBibleOutput,
  options?: Omit<DeriveHomeThemeInput, "coupleId" | "worldIdentity" | "paletteHint"> & {
    memorySubjects?: string[];
  }
): HomeTheme {
  return deriveHomeTheme({
    coupleId,
    worldIdentity: ai.world_identity,
    paletteHint: ai.palette_hint,
    memorySubjects:
      options?.memorySubjects ??
      ai.scene.embedded_memories.map((m) => m.subject),
    previousDirections: options?.previousDirections,
    presetShiftNeeded: options?.presetShiftNeeded,
  });
}
