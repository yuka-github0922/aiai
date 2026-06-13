import { deriveHomeThemeFromLegacy } from "@/lib/couple-home-world/derive-home-theme";
import type {
  ParsedWorldBible,
  WorldBibleLegacy,
  WorldBibleStored,
  WorldBibleV3,
  WorldIdentity,
  WorldScene,
} from "@/lib/couple-home-world/types";
import {
  HOME_WORLD_GROWTH_PROMPT_VERSION,
  HOME_WORLD_PROMPT_VERSION,
  HOME_WORLD_V3_GROWTH_PROMPT_VERSION,
  HOME_WORLD_V3_IDENTITY_PROMPT_VERSION,
} from "@/lib/couple-home-world/types";

function isV3(raw: Record<string, unknown>): raw is WorldBibleV3 {
  return (
    typeof raw.world_identity === "object" &&
    raw.world_identity !== null &&
    typeof raw.scene === "object" &&
    raw.scene !== null &&
    (raw.prompt_version === HOME_WORLD_V3_IDENTITY_PROMPT_VERSION ||
      raw.prompt_version === HOME_WORLD_V3_GROWTH_PROMPT_VERSION)
  );
}

function isLegacy(raw: Record<string, unknown>): raw is WorldBibleLegacy {
  return (
    typeof raw.scene_prompt === "string" &&
    typeof raw.palette === "object" &&
    raw.palette !== null &&
    (raw.prompt_version === HOME_WORLD_PROMPT_VERSION ||
      raw.prompt_version === HOME_WORLD_GROWTH_PROMPT_VERSION)
  );
}

function legacyToScene(legacy: WorldBibleLegacy): WorldScene {
  return {
    mood_summary: legacy.mood_summary,
    atmosphere: legacy.atmosphere,
    composition: legacy.composition,
    embedded_memories: legacy.embedded_memories,
    scene_prompt: legacy.scene_prompt,
  };
}

function legacyToIdentity(legacy: WorldBibleLegacy): WorldIdentity {
  return {
    phrase: legacy.mood_summary,
    mood: legacy.atmosphere,
    sensory: legacy.embedded_memories.map((m) => m.subject).slice(0, 5),
    anchors: legacy.embedded_memories.map((m) => m.subject).slice(0, 5),
  };
}

export function parseWorldBible(
  raw: unknown,
  coupleId?: string
): ParsedWorldBible | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;

  if (isV3(record)) {
    const scene = record.scene;
    if (!scene.scene_prompt) return null;

    return {
      version: "v3",
      stored: record,
      worldIdentity: record.world_identity,
      paletteHint: record.palette_hint,
      scene,
      homeTheme: record.home_theme ?? null,
      flags: {
        identity_evolved: record.identity_evolved,
        visual_change_needed: record.visual_change_needed,
        ui_change_needed: record.ui_change_needed,
        preset_shift_needed: record.preset_shift_needed,
        change_summary: record.change_summary,
      },
    };
  }

  if (isLegacy(record)) {
    const scene = legacyToScene(record);
    if (!scene.scene_prompt) return null;

    const homeTheme =
      coupleId != null ? deriveHomeThemeFromLegacy(coupleId, record) : null;

    return {
      version: "legacy",
      stored: record,
      worldIdentity: legacyToIdentity(record),
      paletteHint: null,
      scene,
      homeTheme,
      flags: {},
    };
  }

  return null;
}

export function getStoredWorldBible(parsed: ParsedWorldBible): WorldBibleStored {
  return parsed.stored;
}

export function getScenePrompt(parsed: ParsedWorldBible): string {
  return parsed.scene.scene_prompt;
}

export function getMoodSummary(parsed: ParsedWorldBible): string {
  return parsed.scene.mood_summary;
}

export function getWorldIdentityPhrase(parsed: ParsedWorldBible): string | null {
  return parsed.worldIdentity?.phrase ?? null;
}
