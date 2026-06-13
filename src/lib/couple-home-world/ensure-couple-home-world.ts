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
  attachHomeThemeToAiOutput,
  buildWorldBibleV3Document,
} from "@/lib/couple-home-world/derive-home-theme";
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
import type { CoupleHomeWorldRow, ParsedWorldBible } from "@/lib/couple-home-world/types";
import {
  HOME_WORLD_ESTABLISHMENT_THRESHOLD,
  HOME_WORLD_V3_GROWTH_PROMPT_VERSION,
  HOME_WORLD_V3_IDENTITY_PROMPT_VERSION,
} from "@/lib/couple-home-world/types";

export type RunCoupleHomeWorldGenerationResult = {
  started: boolean;
  completed: boolean;
  reason?: string;
};

function buildStoredFromGrowth(
  coupleId: string,
  growthOutput: Awaited<ReturnType<typeof generateWorldBibleGrowthWithAI>>,
  previous: ParsedWorldBible,
  options: { uiChangeNeeded: boolean; presetShiftNeeded: boolean }
) {
  if (!growthOutput) return null;

  const previousTheme = previous.homeTheme;
  const shouldRefreshTheme =
    options.uiChangeNeeded ||
    options.presetShiftNeeded ||
    !previousTheme;

  const homeTheme = shouldRefreshTheme
    ? attachHomeThemeToAiOutput(coupleId, growthOutput.output, {
        previousDirections: previousTheme?.directions,
        presetShiftNeeded: options.presetShiftNeeded,
        memorySubjects: growthOutput.output.scene.embedded_memories.map(
          (m) => m.subject
        ),
      })
    : previousTheme!;

  return buildWorldBibleV3Document(
    growthOutput.output,
    homeTheme,
    HOME_WORLD_V3_GROWTH_PROMPT_VERSION,
    growthOutput.flags
  );
}

export async function runCoupleHomeWorldGeneration(
  userSupabase: SupabaseClient,
  coupleId: string,
  names: { self: string; partner: string },
  options?: { forceRetry?: boolean }
): Promise<RunCoupleHomeWorldGenerationResult> {
  await resetStaleCoupleHomeWorldGeneration(coupleId);

  let row = await fetchCoupleHomeWorldRow(userSupabase, coupleId);

  if (options?.forceRetry && row?.status === "generating") {
    if (row.heroImageUrl) {
      await restoreCoupleHomeWorldReadyForCouple(coupleId, "manual_retry");
    } else {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "manual_retry",
      });
    }
    row = await fetchCoupleHomeWorldRow(userSupabase, coupleId);
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
    const aiOutput = await generateWorldBibleWithAI(input);
    if (!aiOutput) {
      await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "failed",
        lastError: "world_bible_generation_failed",
      });
      return { started: true, completed: false, reason: "world_bible_generation_failed" };
    }

    const homeTheme = attachHomeThemeToAiOutput(coupleId, aiOutput, {
      memorySubjects: aiOutput.scene.embedded_memories.map((m) => m.subject),
    });

    const stored = buildWorldBibleV3Document(
      aiOutput,
      homeTheme,
      HOME_WORLD_V3_IDENTITY_PROMPT_VERSION,
      {
        visual_change_needed: true,
        ui_change_needed: true,
        identity_evolved: true,
      }
    );

    const { dataUrl, model } = await generateHeroSceneImage({
      scene: aiOutput.scene,
      worldIdentity: aiOutput.world_identity,
    });

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
      worldBible: stored,
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
      worldIdentity: aiOutput.world_identity.phrase,
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

    const stored = buildStoredFromGrowth(coupleId, growth, row.worldBible!, {
      uiChangeNeeded: growth.flags.ui_change_needed,
      presetShiftNeeded: growth.flags.preset_shift_needed,
    });

    if (!stored) {
      await restoreCoupleHomeWorldReadyForCouple(coupleId, "theme_derivation_failed");
      return { started: true, completed: false, reason: "theme_derivation_failed" };
    }

    if (!growth.flags.visual_change_needed) {
      const saved = await saveCoupleHomeWorldResultForCouple(coupleId, {
        status: "ready",
        worldBible: stored,
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
        changeSummary: growth.flags.change_summary,
        uiUpdated: growth.flags.ui_change_needed,
      });

      revalidatePath("/home");
      return { started: true, completed: true, reason: "no_visual_change" };
    }

    const nextVersion = row.heroImageVersion + 1;
    const { dataUrl, model } = await generateHeroSceneImage(
      {
        scene: growth.output.scene,
        worldIdentity: growth.output.world_identity,
      },
      { continuity: true }
    );

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
      worldBible: stored,
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
      changeSummary: growth.flags.change_summary,
      version: nextVersion,
      worldIdentity: growth.output.world_identity.phrase,
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
