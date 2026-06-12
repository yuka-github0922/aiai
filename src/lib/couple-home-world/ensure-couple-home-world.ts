import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  claimCoupleHomeWorldGenerationForCouple,
  resetStaleCoupleHomeWorldGeneration,
  restoreCoupleHomeWorldReadyForCouple,
  saveCoupleHomeWorldResultForCouple,
  saveHomeWorldHeroToStorageWithAdmin,
} from "@/lib/couple-home-world/couple-home-world-admin";
import {
  fetchCoupleHomeWorldRow,
  fetchRevealedDailyQuestionCount,
  shouldScheduleHomeWorldGeneration,
  shouldScheduleHomeWorldRegrowth,
} from "@/lib/couple-home-world/fetch-couple-home-world";
import {
  collectUpdatedSourceRoundIds,
  fetchHomeWorldGenerationInput,
  fetchHomeWorldRegrowthInput,
} from "@/lib/couple-home-world/fetch-generation-input";
import { generateHeroSceneImage } from "@/lib/couple-home-world/generate-hero-scene-image";
import { generateWorldBibleGrowthWithAI } from "@/lib/couple-home-world/generate-world-bible-growth-ai";
import { generateWorldBibleWithAI } from "@/lib/couple-home-world/generate-world-bible-ai";
import type { CoupleHomeWorldRow } from "@/lib/couple-home-world/types";
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

  if (options?.forceRetry && row?.status === "generating") {
    if (row.heroImageUrl) {
      await restoreCoupleHomeWorldReadyForCouple(coupleId, "manual_retry");
    } else {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "manual_retry",
      });
    }
    row = await fetchCoupleHomeWorldRow(userSupabase);
  }

  const revealedCount = await fetchRevealedDailyQuestionCount(userSupabase);

  if (
    row?.status === "ready" &&
    row.heroImageUrl &&
    row.worldBible &&
    shouldScheduleHomeWorldRegrowth(revealedCount, row)
  ) {
    return runCoupleHomeWorldRegrowth(userSupabase, coupleId, names, row);
  }

  const input = await fetchHomeWorldGenerationInput(userSupabase, names);

  if (!input || input.revealedCount < HOME_WORLD_ESTABLISHMENT_THRESHOLD) {
    return {
      started: false,
      completed: false,
      reason: "insufficient_revealed_questions",
    };
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

  console.log("[couple-home-world] phase1 generation started", {
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
      dataUrl,
      1
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
      generationPhase: 1,
      heroImageVersion: 1,
    });

    if (!saved) {
      return { started: true, completed: false, reason: "save_ready_failed" };
    }

    console.log("[couple-home-world] phase1 generation completed", {
      coupleId,
      heroImageUrl,
    });

    revalidatePath("/home");
    return { started: true, completed: true };
  } catch (err) {
    console.error("[couple-home-world] phase1 generation error:", err);
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

async function runCoupleHomeWorldRegrowth(
  userSupabase: SupabaseClient,
  coupleId: string,
  names: { self: string; partner: string },
  row: CoupleHomeWorldRow
): Promise<RunCoupleHomeWorldGenerationResult> {
  const regrowthInput = await fetchHomeWorldRegrowthInput(
    userSupabase,
    names,
    row.worldBible!,
    row.sourceRoundIds
  );

  if (!regrowthInput) {
    return {
      started: false,
      completed: false,
      reason: "no_new_rounds",
    };
  }

  const claimed = await claimCoupleHomeWorldGenerationForCouple(coupleId, {
    regrowth: true,
  });
  if (!claimed) {
    return {
      started: false,
      completed: false,
      reason: "regrowth_claim_failed",
    };
  }

  console.log("[couple-home-world] phase2 regrowth started", {
    coupleId,
    newRoundCount: regrowthInput.newRounds.length,
    revealedCount: regrowthInput.revealedCount,
  });

  const sourceRoundIds = collectUpdatedSourceRoundIds(
    row.sourceRoundIds,
    regrowthInput.newRounds
  );
  const now = new Date().toISOString();

  try {
    const growth = await generateWorldBibleGrowthWithAI(regrowthInput);
    if (!growth) {
      await restoreCoupleHomeWorldReadyForCouple(
        coupleId,
        "world_bible_growth_failed"
      );
      return {
        started: true,
        completed: false,
        reason: "world_bible_growth_failed",
      };
    }

    if (!growth.visualChangeNeeded) {
      const saved = await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "ready",
        worldBible: growth.worldBible,
        sourceRoundIds,
        sourceRevealedCount: regrowthInput.revealedCount,
        lastError: null,
        generationPhase: 2,
        touchRegeneration: true,
        lastRegenerationAt: now,
      });

      if (!saved) {
        await restoreCoupleHomeWorldReadyForCouple(coupleId, "save_metadata_failed");
        return { started: true, completed: false, reason: "save_metadata_failed" };
      }

      console.log("[couple-home-world] phase2 regrowth skipped image", {
        coupleId,
        changeSummary: growth.changeSummary,
      });

      revalidatePath("/home");
      return { started: true, completed: true, reason: "no_visual_change" };
    }

    const nextVersion = row.heroImageVersion + 1;
    const { dataUrl, model } = await generateHeroSceneImage(growth.worldBible, {
      continuity: true,
    });

    if (!dataUrl) {
      await restoreCoupleHomeWorldReadyForCouple(
        coupleId,
        "hero_image_regrowth_failed"
      );
      return {
        started: true,
        completed: false,
        reason: "hero_image_regrowth_failed",
      };
    }

    const heroImageUrl = await saveHomeWorldHeroToStorageWithAdmin(
      coupleId,
      dataUrl,
      nextVersion
    );

    if (!heroImageUrl) {
      await restoreCoupleHomeWorldReadyForCouple(
        coupleId,
        "hero_image_storage_failed"
      );
      return {
        started: true,
        completed: false,
        reason: "hero_image_storage_failed",
      };
    }

    const saved = await saveCoupleHomeWorldResultForCouple(coupleId, {
      status: "ready",
      heroImageUrl,
      worldBible: growth.worldBible,
      sourceRoundIds,
      sourceRevealedCount: regrowthInput.revealedCount,
      model: model ?? "unknown",
      lastError: null,
      generationPhase: 2,
      bumpHeroVersion: true,
      touchRegeneration: true,
      lastRegenerationAt: now,
    });

    if (!saved) {
      await restoreCoupleHomeWorldReadyForCouple(coupleId, "save_ready_failed");
      return { started: true, completed: false, reason: "save_ready_failed" };
    }

    console.log("[couple-home-world] phase2 regrowth completed", {
      coupleId,
      heroImageUrl,
      changeSummary: growth.changeSummary,
      version: nextVersion,
    });

    revalidatePath("/home");
    return { started: true, completed: true };
  } catch (err) {
    console.error("[couple-home-world] phase2 regrowth error:", err);
    await restoreCoupleHomeWorldReadyForCouple(
      coupleId,
      err instanceof Error ? err.message : "unknown_error"
    );
    return {
      started: true,
      completed: false,
      reason: err instanceof Error ? err.message : "unknown_error",
    };
  }
}
