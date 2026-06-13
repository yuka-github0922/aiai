import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCoupleObservationsSourceSummary,
  fetchCoupleTraitsGenerationContext,
} from "@/lib/couple-traits-context";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import {
  generateCoupleObservationsWithAI,
  hasObservationSourceData,
} from "@/lib/generate-couple-observations";
import type { CachedCoupleObservationNotice } from "@/lib/couple-traits-types";

export type RegenerateCachedCoupleObservationsResult = {
  saved: boolean;
  reason?: string;
  notices?: CachedCoupleObservationNotice[];
};

export async function regenerateCachedCoupleObservations(
  supabase: SupabaseClient
): Promise<RegenerateCachedCoupleObservationsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false, reason: "no_user" };
  }

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.couple_id) {
    return { saved: false, reason: "no_couple" };
  }

  const context = await fetchCoupleTraitsGenerationContext(supabase, user.id);
  if (context.members.length === 0) {
    return { saved: false, reason: "no_members" };
  }

  const sourceSummary = buildCoupleObservationsSourceSummary(context);

  if (!hasObservationSourceData(context)) {
    const { error } = await supabase.rpc("upsert_cached_couple_observations", {
      p_recent_notices: [],
      p_source_summary: sourceSummary,
      p_observations_model: "none",
    });

    if (error) {
      console.error(
        formatSupabaseError(error, "[regenerateCachedCoupleObservations] empty upsert")
      );
      return { saved: false, reason: "upsert_error" };
    }

    return { saved: true, notices: [] };
  }

  const generated = await generateCoupleObservationsWithAI(context);
  if (!generated) {
    return { saved: false, reason: "generation_failed" };
  }

  const { error } = await supabase.rpc("upsert_cached_couple_observations", {
    p_recent_notices: generated.notices,
    p_source_summary: sourceSummary,
    p_observations_model: generated.model,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[regenerateCachedCoupleObservations] upsert")
    );
    return { saved: false, reason: "upsert_error" };
  }

  return { saved: true, notices: generated.notices };
}
