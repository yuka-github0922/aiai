import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import {
  buildCoupleTraitsSourceSummary,
  fetchCoupleTraitsGenerationContext,
} from "@/lib/couple-traits-context";
import { generateCoupleTraitsWithAI } from "@/lib/generate-couple-traits";
import type {
  CachedCoupleTraitMember,
  CoupleTraitsGenerationContext,
} from "@/lib/couple-traits-types";

export type RegenerateCachedCoupleTraitsResult = {
  saved: boolean;
  reason?: string;
};

function mapAiResultToCacheSlots(
  context: CoupleTraitsGenerationContext,
  aiSelf: { name: string; traits: string[] },
  aiPartner: { name: string; traits: string[] } | null
): {
  selfTraits: CachedCoupleTraitMember;
  partnerTraits: CachedCoupleTraitMember | null;
} {
  const firstMember = context.members[0];
  const secondMember = context.members[1] ?? null;

  const selfTraits: CachedCoupleTraitMember = {
    user_id: firstMember.userId,
    name: aiSelf.name || firstMember.name,
    traits: aiSelf.traits,
  };

  if (!secondMember || !aiPartner) {
    return { selfTraits, partnerTraits: null };
  }

  const partnerTraits: CachedCoupleTraitMember = {
    user_id: secondMember.userId,
    name: aiPartner.name || secondMember.name,
    traits: aiPartner.traits,
  };

  return { selfTraits, partnerTraits };
}

export async function regenerateCachedCoupleTraits(
  supabase: SupabaseClient
): Promise<RegenerateCachedCoupleTraitsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false, reason: "no_user" };
  }

  const context = await fetchCoupleTraitsGenerationContext(supabase, user.id);
  if (context.members.length === 0) {
    return { saved: false, reason: "no_members" };
  }

  const generated = await generateCoupleTraitsWithAI(context);
  if (!generated) {
    return { saved: false, reason: "generation_failed" };
  }

  const { selfTraits, partnerTraits } = mapAiResultToCacheSlots(
    context,
    generated.result.self,
    generated.result.partner
  );

  const sourceSummary = buildCoupleTraitsSourceSummary(context);

  const { error } = await supabase.rpc("upsert_cached_couple_traits", {
    p_self_traits: selfTraits,
    p_partner_traits: partnerTraits,
    p_source_summary: sourceSummary,
    p_model: generated.model,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[regenerateCachedCoupleTraits] upsert")
    );
    return { saved: false, reason: "upsert_error" };
  }

  return { saved: true };
}
