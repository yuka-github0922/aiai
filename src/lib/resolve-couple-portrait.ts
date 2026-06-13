import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCachedCoupleTraits } from "@/lib/fetch-cached-couple-traits";
import {
  buildCouplePortrait,
  type CouplePortrait,
  type CouplePortraitInput,
} from "@/lib/couple-portrait";
import { getCoupleAvatarDisplayUrl } from "@/lib/couple-avatar-display-url";
import {
  fillMissingCoupleAvatars,
  hasCoupleAvatars,
  regenerateCachedCoupleTraits,
} from "@/lib/regenerate-cached-couple-traits";
import { regenerateCachedCoupleObservations } from "@/lib/regenerate-cached-couple-observations";
import {
  COUPLE_OBSERVATIONS_PROMPT_VERSION,
  COUPLE_TRAITS_PROMPT_VERSION,
  type CachedCoupleTraitsRow,
} from "@/lib/couple-traits-types";

function isTraitsCacheCurrent(row: CachedCoupleTraitsRow): boolean {
  return row.source_summary?.prompt_version === COUPLE_TRAITS_PROMPT_VERSION;
}

function isObservationsCacheCurrent(row: CachedCoupleTraitsRow): boolean {
  return (
    row.source_summary?.observations_prompt_version ===
    COUPLE_OBSERVATIONS_PROMPT_VERSION
  );
}

function portraitFromCache(row: CachedCoupleTraitsRow): CouplePortrait {
  const members = [row.self_traits];
  if (row.partner_traits?.traits?.length) {
    members.push(row.partner_traits);
  }

  return {
    traits: members.map((member) => ({
      name: member.name,
      traits: member.traits,
      avatarUrl: member.avatar_url ?? null,
      isAiGenerated: true,
    })),
    recentNotices: row.recent_notices ?? [],
  };
}

async function ensureObservationsCache(
  supabase: SupabaseClient,
  coupleId: string,
  cached: CachedCoupleTraitsRow
): Promise<CachedCoupleTraitsRow> {
  if (isObservationsCacheCurrent(cached)) {
    return cached;
  }

  const result = await regenerateCachedCoupleObservations(supabase);
  if (!result.saved) {
    return cached;
  }

  return (await fetchCachedCoupleTraits(supabase, coupleId)) ?? cached;
}

export async function resolveCouplePortrait(
  supabase: SupabaseClient,
  coupleId: string,
  fallbackInput: CouplePortraitInput
): Promise<CouplePortrait> {
  let cached = await fetchCachedCoupleTraits(supabase, coupleId);
  if (cached && isTraitsCacheCurrent(cached) && !hasCoupleAvatars(cached)) {
    const fillResult = await fillMissingCoupleAvatars(supabase, cached);
    if (fillResult.saved && fillResult.selfTraits) {
      cached = {
        ...cached,
        self_traits: fillResult.selfTraits,
        partner_traits: fillResult.partnerTraits ?? cached.partner_traits,
      };
    } else {
      cached = (await fetchCachedCoupleTraits(supabase, coupleId)) ?? cached;
    }
  }

  if (cached && isTraitsCacheCurrent(cached)) {
    const withObservations = await ensureObservationsCache(
      supabase,
      coupleId,
      cached
    );
    const portrait = portraitFromCache(withObservations);
    if (portrait.traits.length > 0) {
      return portrait;
    }
  }

  const regenerate = await regenerateCachedCoupleTraits(supabase);
  if (regenerate.saved) {
    const fresh = await fetchCachedCoupleTraits(supabase, coupleId);
    if (fresh) {
      return portraitFromCache(fresh);
    }
  }

  return buildCouplePortrait(fallbackInput);
}
