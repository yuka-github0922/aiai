import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import { parseWorldBible } from "@/lib/couple-home-world/parse-world-bible";
import type {
  CoupleHomeWorldDisplay,
  CoupleHomeWorldRow,
  CoupleHomeWorldStatus,
} from "@/lib/couple-home-world/types";
import {
  HOME_WORLD_ESTABLISHMENT_THRESHOLD,
  HOME_WORLD_GENERATION_STALE_MS,
  HOME_WORLD_REGROWTH_MIN_HOURS,
  HOME_WORLD_REGROWTH_MIN_NEW_ROUNDS,
} from "@/lib/couple-home-world/types";
import {
  resolveCoupleWorldTheme,
  resolveWorldPhrase,
} from "@/lib/couple-home-world/resolve-couple-world-display";

function isMissingRelationError(error: PostgrestError): boolean {
  return (
    error.code === "42P01" ||
    error.message?.includes("couple_home_world") ||
    error.message?.includes("does not exist")
  );
}

function isMissingRpcError(error: PostgrestError, fn: string): boolean {
  return (
    error.code === "PGRST202" ||
    error.message?.includes(fn) ||
    error.message?.includes("Could not find the function")
  );
}

function parseHomeWorldRow(data: unknown, coupleId?: string): CoupleHomeWorldRow | null {
  if (!data || typeof data !== "object") return null;

  const row = data as {
    couple_id?: string;
    status?: CoupleHomeWorldStatus;
    hero_image_url?: string | null;
    hero_image_version?: number;
    world_bible?: unknown;
    source_round_ids?: string[];
    source_revealed_count?: number;
    generation_phase?: number;
    generated_at?: string | null;
    last_regeneration_at?: string | null;
    updated_at?: string | null;
  };

  if (!row.couple_id || !row.status) return null;

  const resolvedCoupleId = coupleId ?? row.couple_id;

  return {
    coupleId: row.couple_id,
    status: row.status,
    heroImageUrl: row.hero_image_url ?? null,
    heroImageVersion: row.hero_image_version ?? 1,
    worldBible: parseWorldBible(row.world_bible, resolvedCoupleId),
    sourceRoundIds: row.source_round_ids ?? [],
    sourceRevealedCount: row.source_revealed_count ?? 0,
    generationPhase: row.generation_phase ?? 1,
    generatedAt: row.generated_at ?? null,
    lastRegenerationAt: row.last_regeneration_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function fetchRevealedDailyQuestionCount(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase.rpc("get_revealed_daily_question_count");

  if (error) {
    if (isMissingRpcError(error, "get_revealed_daily_question_count")) {
      console.warn(
        "[couple-home-world] count RPC missing — apply migration 20260524000000_couple_home_world.sql"
      );
      return 0;
    }
    console.error(formatSupabaseError(error, "[fetchRevealedDailyQuestionCount]"));
    return 0;
  }

  return typeof data === "number" ? data : 0;
}

export async function fetchCoupleHomeWorldRow(
  supabase: SupabaseClient,
  coupleId?: string
): Promise<CoupleHomeWorldRow | null> {
  const { data, error } = await supabase.rpc("get_couple_home_world");

  if (error) {
    if (isMissingRelationError(error) || isMissingRpcError(error, "get_couple_home_world")) {
      console.warn(
        "[couple-home-world] get_couple_home_world missing — apply migration 20260524000000_couple_home_world.sql"
      );
      return null;
    }
    console.error(formatSupabaseError(error, "[fetchCoupleHomeWorldRow]"));
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return parseHomeWorldRow(row, coupleId);
}

function isGenerationInProgress(row: CoupleHomeWorldRow | null): boolean {
  if (!row || row.status !== "generating" || !row.updatedAt) return false;
  const updatedMs = new Date(row.updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return true;
  return Date.now() - updatedMs < HOME_WORLD_GENERATION_STALE_MS;
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60);
}

export function shouldScheduleHomeWorldRegrowth(
  revealedCount: number,
  row: CoupleHomeWorldRow | null
): boolean {
  if (!row || row.status !== "ready" || !row.heroImageUrl || !row.worldBible) {
    return false;
  }

  if (isGenerationInProgress(row)) {
    return false;
  }

  const newRevealedCount = revealedCount - row.sourceRevealedCount;
  if (newRevealedCount <= 0) {
    return false;
  }

  const conditionA = newRevealedCount >= HOME_WORLD_REGROWTH_MIN_NEW_ROUNDS;

  const lastTouch = row.lastRegenerationAt ?? row.generatedAt;
  const elapsedHours = hoursSince(lastTouch);
  const conditionB =
    elapsedHours !== null &&
    elapsedHours >= HOME_WORLD_REGROWTH_MIN_HOURS &&
    newRevealedCount >= 1;

  return conditionA || conditionB;
}

export function deriveCoupleHomeSceneState(
  revealedCount: number,
  row: CoupleHomeWorldRow | null
): CoupleHomeWorldDisplay["sceneState"] {
  if (revealedCount < HOME_WORLD_ESTABLISHMENT_THRESHOLD) {
    return "nascent";
  }

  if (row?.heroImageUrl) {
    return "ready";
  }

  return "establishing";
}

export async function fetchCoupleHomeWorldDisplay(
  supabase: SupabaseClient,
  coupleId?: string
): Promise<CoupleHomeWorldDisplay> {
  const [revealedCount, row] = await Promise.all([
    fetchRevealedDailyQuestionCount(supabase),
    fetchCoupleHomeWorldRow(supabase, coupleId),
  ]);

  const sceneState = deriveCoupleHomeSceneState(revealedCount, row);
  const shouldRegrow = shouldScheduleHomeWorldRegrowth(revealedCount, row);
  const theme = resolveCoupleWorldTheme(row);

  return {
    sceneState,
    heroImageUrl: row?.heroImageUrl ?? null,
    phrase: resolveWorldPhrase(row?.worldBible ?? null, sceneState),
    homeThemeCssVars: theme.homeThemeCssVars,
    expression: theme.expression,
    revealedCount,
    shouldRegrow,
  };
}

export function shouldScheduleHomeWorldGeneration(
  revealedCount: number,
  row: CoupleHomeWorldRow | null
): boolean {
  if (revealedCount < HOME_WORLD_ESTABLISHMENT_THRESHOLD) {
    return false;
  }

  if (row?.status === "ready" || row?.heroImageUrl) {
    return false;
  }

  if (isGenerationInProgress(row)) {
    return false;
  }

  return true;
}
