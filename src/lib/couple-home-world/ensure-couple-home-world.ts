import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  claimCoupleHomeWorldGenerationForCouple,
  resetStaleCoupleHomeWorldGeneration,
  saveCoupleHomeWorldResultForCouple,
  saveHomeWorldHeroToStorageWithAdmin,
} from "@/lib/couple-home-world/couple-home-world-admin";
import {
  fetchCoupleHomeWorldRow,
  shouldScheduleHomeWorldGeneration,
} from "@/lib/couple-home-world/fetch-couple-home-world";
import { fetchHomeWorldGenerationInput } from "@/lib/couple-home-world/fetch-generation-input";
import { generateHeroSceneImage } from "@/lib/couple-home-world/generate-hero-scene-image";
import { generateWorldBibleWithAI } from "@/lib/couple-home-world/generate-world-bible-ai";
import { HOME_WORLD_ESTABLISHMENT_THRESHOLD } from "@/lib/couple-home-world/types";

export type RunCoupleHomeWorldGenerationResult = {
  started: boolean;
  completed: boolean;
  reason?: string;
};

export async function runCoupleHomeWorldGeneration(
  userSupabase: SupabaseClient,
  coupleId: string,
  names: { self: string; partner: string },
  options?: { forceRetry?: boolean }
): Promise<RunCoupleHomeWorldGenerationResult> {
  await resetStaleCoupleHomeWorldGeneration(coupleId);

  let row = await fetchCoupleHomeWorldRow(userSupabase);
  const input = await fetchHomeWorldGenerationInput(userSupabase, names);

  if (!input || input.revealedCount < HOME_WORLD_ESTABLISHMENT_THRESHOLD) {
    return {
      started: false,
      completed: false,
      reason: "insufficient_revealed_questions",
    };
  }

  if (options?.forceRetry && row?.status === "generating") {
    await saveCoupleHomeWorldResultForCouple(coupleId, {
      status: "failed",
      lastError: "manual_retry",
    });
    row = await fetchCoupleHomeWorldRow(userSupabase);
  }

  if (!shouldScheduleHomeWorldGeneration(input.revealedCount, row)) {
    return {
      started: false,
      completed: row?.status === "ready",
      reason: row?.status === "ready" ? "already_ready" : "generation_in_progress",
    };
  }

  const claimed = await claimCoupleHomeWorldGenerationForCouple(coupleId);
  if (!claimed) {
    return {
      started: false,
      completed: false,
      reason: "claim_failed",
    };
  }

  console.log("[couple-home-world] generation started", {
    coupleId,
    revealedCount: input.revealedCount,
    roundCount: input.rounds.length,
  });

  try {
    const worldBible = await generateWorldBibleWithAI(input);
    if (!worldBible) {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "world_bible_generation_failed",
      });
      return { started: true, completed: false, reason: "world_bible_generation_failed" };
    }

    const { dataUrl, model } = await generateHeroSceneImage(worldBible);
    if (!dataUrl) {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "hero_image_generation_failed",
      });
      return { started: true, completed: false, reason: "hero_image_generation_failed" };
    }

    const heroImageUrl = await saveHomeWorldHeroToStorageWithAdmin(
      coupleId,
      dataUrl
    );
    if (!heroImageUrl) {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "hero_image_storage_failed",
      });
      return { started: true, completed: false, reason: "hero_image_storage_failed" };
    }

    const saved = await saveCoupleHomeWorldResultForCouple(coupleId, {
      status: "ready",
      heroImageUrl,
      worldBible,
      sourceRoundIds: input.rounds.map((round) => round.roundId),
      sourceRevealedCount: input.revealedCount,
      model: model ?? "unknown",
      lastError: null,
    });

    if (!saved) {
      return { started: true, completed: false, reason: "save_ready_failed" };
    }

    console.log("[couple-home-world] generation completed", {
      coupleId,
      heroImageUrl,
    });

    revalidatePath("/home");
    return { started: true, completed: true };
  } catch (err) {
    console.error("[couple-home-world] generation error:", err);
    await saveCoupleHomeWorldResultForCouple(coupleId, {
      status: "failed",
      lastError: err instanceof Error ? err.message : "unknown_error",
    });
    return {
      started: true,
      completed: false,
      reason: err instanceof Error ? err.message : "unknown_error",
    };
  }
}
