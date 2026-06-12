import "server-only";

import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type {
  CoupleHomeWorldStatus,
  WorldBible,
} from "@/lib/couple-home-world/types";

export async function resetStaleCoupleHomeWorldGeneration(
  coupleId: string
): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("service_reset_stale_couple_home_world_generation", {
    p_couple_id: coupleId,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[resetStaleCoupleHomeWorldGeneration]")
    );
  }
}

export async function claimCoupleHomeWorldGenerationForCouple(
  coupleId: string
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc(
    "service_claim_couple_home_world_generation",
    { p_couple_id: coupleId }
  );

  if (error) {
    console.error(
      formatSupabaseError(error, "[claimCoupleHomeWorldGenerationForCouple]")
    );
    return false;
  }

  return data === true;
}

export async function saveCoupleHomeWorldResultForCouple(
  coupleId: string,
  params: {
    status: CoupleHomeWorldStatus;
    heroImageUrl?: string | null;
    worldBible?: WorldBible;
    sourceRoundIds?: string[];
    sourceRevealedCount?: number;
    model?: string;
    lastError?: string | null;
  }
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("service_upsert_couple_home_world", {
    p_couple_id: coupleId,
    p_status: params.status,
    p_hero_image_url: params.heroImageUrl ?? null,
    p_world_bible: params.worldBible ?? {},
    p_source_round_ids: params.sourceRoundIds ?? [],
    p_source_revealed_count: params.sourceRevealedCount ?? 0,
    p_model: params.model ?? null,
    p_last_error: params.lastError ?? null,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[saveCoupleHomeWorldResultForCouple]")
    );
    return false;
  }

  return true;
}

export async function saveHomeWorldHeroToStorageWithAdmin(
  coupleId: string,
  dataUrl: string
): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { saveHomeWorldHeroToStorage } = await import(
    "@/lib/couple-home-world/save-home-world-storage"
  );
  return saveHomeWorldHeroToStorage(admin, coupleId, dataUrl);
}
