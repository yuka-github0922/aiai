import { createClient } from "@/lib/supabase/server";
import { buildProfileOnboardingProgress } from "./profile-onboarding-state";
import type { ProfileOnboardingData } from "./profile-onboarding-types";

type RawProfileRow = {
  display_name: string | null;
  partner_nickname: string | null;
  profile_onboarding_completed_at: string | null;
  profile_onboarding_dismissed_at: string | null;
  profile_onboarding_skipped: string[] | null;
};

type RawSummaryRow = {
  birth_date: string | null;
  gender: string | null;
  residence: string | null;
  mbti: string | null;
  animal_zodiac: string | null;
  basic_values: string | null;
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
  partner_impression: string | null;
};

export async function fetchProfileOnboardingData(
  userId: string,
  coupleId?: string | null
): Promise<ProfileOnboardingData> {
  const supabase = await createClient();

  const [
    { data: profile, error: profileError },
    { data: summary, error: summaryError },
    { count: anniversaryCount, error: anniversaryError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, partner_nickname, profile_onboarding_completed_at, profile_onboarding_dismissed_at, profile_onboarding_skipped"
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("ai_summaries")
      .select(
        "birth_date, gender, residence, mbti, animal_zodiac, basic_values, communication_style, comfortable_phrases, avoid_phrases, notes, partner_impression"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    coupleId
      ? supabase
          .from("anniversaries")
          .select("id", { count: "exact", head: true })
          .eq("couple_id", coupleId)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (profileError || summaryError || anniversaryError) {
    console.error("[profile-onboarding] fetch errors:", {
      profileError: profileError?.message,
      summaryError: summaryError?.message,
      anniversaryError: anniversaryError?.message,
    });
  }

  const p = profile as RawProfileRow | null;
  const s = summary as RawSummaryRow | null;

  return {
    displayName: p?.display_name ?? null,
    partnerNickname: p?.partner_nickname ?? null,
    birthDate: s?.birth_date ?? null,
    gender: s?.gender ?? null,
    residence: s?.residence ?? null,
    mbti: s?.mbti ?? null,
    animalZodiac: s?.animal_zodiac ?? null,
    basicValues: s?.basic_values ?? null,
    communicationStyle: s?.communication_style ?? null,
    comfortablePhrases: s?.comfortable_phrases ?? null,
    avoidPhrases: s?.avoid_phrases ?? null,
    notes: s?.notes ?? null,
    partnerImpression: s?.partner_impression ?? null,
    hasAnniversary: (anniversaryCount ?? 0) > 0,
    skipped: p?.profile_onboarding_skipped ?? [],
    completedAt: p?.profile_onboarding_completed_at ?? null,
    dismissedAt: p?.profile_onboarding_dismissed_at ?? null,
  };
}

export async function fetchProfileOnboardingProgress(
  userId: string,
  hasPartner: boolean,
  coupleId?: string | null
) {
  const data = await fetchProfileOnboardingData(userId, coupleId);
  return {
    data,
    progress: buildProfileOnboardingProgress(data, hasPartner),
  };
}
