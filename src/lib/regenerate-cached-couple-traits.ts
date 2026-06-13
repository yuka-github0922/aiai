import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import {
  buildCoupleObservationsSourceSummary,
  buildCoupleTraitsSourceSummary,
  fetchCoupleTraitsGenerationContext,
} from "@/lib/couple-traits-context";
import { generateCoupleObservationsWithAI } from "@/lib/generate-couple-observations";
import { generateCoupleAvatarWithAI } from "@/lib/generate-couple-avatar";
import { generateCoupleTraitsWithAI } from "@/lib/generate-couple-traits";
import { saveCoupleAvatarToStorage } from "@/lib/save-couple-avatar-storage";
import type {
  CachedCoupleTraitMember,
  CachedCoupleTraitsRow,
  CoupleTraitsGenerationContext,
} from "@/lib/couple-traits-types";

export function hasCoupleAvatars(row: CachedCoupleTraitsRow): boolean {
  const members = [row.self_traits, row.partner_traits].filter(
    (member): member is CachedCoupleTraitMember => member !== null
  );

  if (members.length === 0) return false;

  return members.every(
    (member) =>
      typeof member.avatar_url === "string" && member.avatar_url.length > 0
  );
}

export type RegenerateCachedCoupleTraitsResult = {
  saved: boolean;
  reason?: string;
  selfTraits?: CachedCoupleTraitMember;
  partnerTraits?: CachedCoupleTraitMember | null;
};

async function persistAvatarUrl(
  supabase: SupabaseClient,
  coupleId: string,
  userId: string,
  dataUrl: string | null
): Promise<string | null> {
  if (!dataUrl) return null;

  const storageUrl = await saveCoupleAvatarToStorage(
    supabase,
    coupleId,
    userId,
    dataUrl
  );

  if (storageUrl) {
    console.log("[persistAvatarUrl] saved to storage", { userId, storageUrl });
    return storageUrl;
  }

  console.warn(
    "[persistAvatarUrl] storage upload failed, keeping data URL for API route",
    { userId }
  );
  return dataUrl;
}

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

async function attachAvatars(
  supabase: SupabaseClient,
  coupleId: string,
  context: CoupleTraitsGenerationContext,
  selfTraits: CachedCoupleTraitMember,
  partnerTraits: CachedCoupleTraitMember | null,
  aiSelf: { name: string; traits: string[] },
  aiPartner: { name: string; traits: string[] } | null
): Promise<{
  selfTraits: CachedCoupleTraitMember;
  partnerTraits: CachedCoupleTraitMember | null;
}> {
  const firstMember = context.members[0];
  const secondMember = context.members[1] ?? null;

  const [selfDataUrl, partnerDataUrl] = await Promise.all([
    generateCoupleAvatarWithAI({
      name: selfTraits.name,
      traits: aiSelf.traits,
      member: firstMember,
    }),
    partnerTraits && secondMember && aiPartner
      ? generateCoupleAvatarWithAI({
          name: partnerTraits.name,
          traits: aiPartner.traits,
          member: secondMember,
        })
      : Promise.resolve(null),
  ]);

  const [selfAvatar, partnerAvatar] = await Promise.all([
    persistAvatarUrl(supabase, coupleId, selfTraits.user_id, selfDataUrl),
    partnerTraits
      ? persistAvatarUrl(
          supabase,
          coupleId,
          partnerTraits.user_id,
          partnerDataUrl
        )
      : Promise.resolve(null),
  ]);

  return {
    selfTraits: {
      ...selfTraits,
      avatar_url: selfAvatar,
    },
    partnerTraits: partnerTraits
      ? {
          ...partnerTraits,
          avatar_url: partnerAvatar,
        }
      : null,
  };
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

  const generated = await generateCoupleTraitsWithAI(context);
  if (!generated) {
    return { saved: false, reason: "generation_failed" };
  }

  const baseSlots = mapAiResultToCacheSlots(
    context,
    generated.result.self,
    generated.result.partner
  );

  const { selfTraits, partnerTraits } = await attachAvatars(
    supabase,
    membership.couple_id,
    context,
    baseSlots.selfTraits,
    baseSlots.partnerTraits,
    generated.result.self,
    generated.result.partner
  );

  const sourceSummary = {
    ...buildCoupleTraitsSourceSummary(context),
    avatar_model: "gpt-image-1",
  };

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

  await saveCoupleObservationsFromContext(supabase, context);

  return { saved: true, selfTraits, partnerTraits };
}

async function saveCoupleObservationsFromContext(
  supabase: SupabaseClient,
  context: CoupleTraitsGenerationContext
): Promise<void> {
  const generated = await generateCoupleObservationsWithAI(context);
  if (!generated) return;

  const { error } = await supabase.rpc("upsert_cached_couple_observations", {
    p_recent_notices: generated.notices,
    p_source_summary: buildCoupleObservationsSourceSummary(context),
    p_observations_model: generated.model,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[regenerateCachedCoupleTraits] observations upsert")
    );
  }
}

export async function fillMissingCoupleAvatars(
  supabase: SupabaseClient,
  cached: CachedCoupleTraitsRow
): Promise<RegenerateCachedCoupleTraitsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: false, reason: "no_user" };
  }

  if (hasCoupleAvatars(cached)) {
    return { saved: true };
  }

  const context = await fetchCoupleTraitsGenerationContext(supabase, user.id);
  if (context.members.length === 0) {
    return { saved: false, reason: "no_members" };
  }

  const memberById = new Map(context.members.map((member) => [member.userId, member]));

  const selfMember = memberById.get(cached.self_traits.user_id) ?? context.members[0];
  const partnerMember = cached.partner_traits
    ? memberById.get(cached.partner_traits.user_id) ?? context.members[1] ?? null
    : null;

  const [selfDataUrl, partnerDataUrl] = await Promise.all([
    cached.self_traits.avatar_url
      ? Promise.resolve(cached.self_traits.avatar_url)
      : generateCoupleAvatarWithAI({
          name: cached.self_traits.name,
          traits: cached.self_traits.traits,
          member: selfMember,
        }),
    cached.partner_traits && partnerMember
      ? cached.partner_traits.avatar_url
        ? Promise.resolve(cached.partner_traits.avatar_url)
        : generateCoupleAvatarWithAI({
            name: cached.partner_traits.name,
            traits: cached.partner_traits.traits,
            member: partnerMember,
          })
      : Promise.resolve(null),
  ]);

  const needsSelfPersist =
    !cached.self_traits.avatar_url && !!selfDataUrl?.startsWith("data:");
  const needsPartnerPersist =
    !!cached.partner_traits &&
    !cached.partner_traits.avatar_url &&
    !!partnerDataUrl?.startsWith("data:");

  const [selfAvatar, partnerAvatar] = await Promise.all([
    needsSelfPersist
      ? persistAvatarUrl(
          supabase,
          cached.couple_id,
          cached.self_traits.user_id,
          selfDataUrl
        )
      : Promise.resolve(selfDataUrl ?? cached.self_traits.avatar_url ?? null),
    cached.partner_traits
      ? needsPartnerPersist
        ? persistAvatarUrl(
            supabase,
            cached.couple_id,
            cached.partner_traits.user_id,
            partnerDataUrl
          )
        : Promise.resolve(
            partnerDataUrl ?? cached.partner_traits.avatar_url ?? null
          )
      : Promise.resolve(null),
  ]);

  const gotNewAvatar =
    (!cached.self_traits.avatar_url && !!selfAvatar) ||
    (!!cached.partner_traits &&
      !cached.partner_traits.avatar_url &&
      !!partnerAvatar);

  if (!gotNewAvatar) {
    return { saved: false, reason: "avatar_generation_failed" };
  }

  const selfTraits: CachedCoupleTraitMember = {
    ...cached.self_traits,
    avatar_url: selfAvatar ?? cached.self_traits.avatar_url ?? null,
  };

  const partnerTraits = cached.partner_traits
    ? {
        ...cached.partner_traits,
        avatar_url: partnerAvatar ?? cached.partner_traits.avatar_url ?? null,
      }
    : null;

  const sourceSummary = {
    ...(cached.source_summary ?? {}),
    avatar_model: "gpt-image-1",
    avatars_filled_at: new Date().toISOString(),
  };

  const { error } = await supabase.rpc("upsert_cached_couple_traits", {
    p_self_traits: selfTraits,
    p_partner_traits: partnerTraits,
    p_source_summary: sourceSummary,
    p_model: cached.model,
  });

  if (error) {
    console.error(
      formatSupabaseError(error, "[fillMissingCoupleAvatars] upsert")
    );
    return { saved: false, reason: "upsert_error" };
  }

  console.log("[fillMissingCoupleAvatars] saved", {
    selfAvatar: !!selfTraits.avatar_url,
    partnerAvatar: !!partnerTraits?.avatar_url,
    selfUrlPrefix: selfTraits.avatar_url?.slice(0, 40),
  });

  return { saved: true, selfTraits, partnerTraits };
}
