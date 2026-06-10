import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatSelfProfile = {
  displayName: string | null;
  birthDate: string | null;
  mbti: string | null;
  animalZodiac: string | null;
  residence: string | null;
  basicValues: string | null;
  partnerImpression: string | null;
};

export type ChatPartnerProfile = {
  displayName: string | null;
  birthDate: string | null;
  mbti: string | null;
  animalZodiac: string | null;
  residence: string | null;
  basicValues: string | null;
  gender: string | null;
  birthYear: number | null;
  communicationStyle: string | null;
  comfortablePhrases: string | null;
  avoidPhrases: string | null;
  notes: string | null;
};

export type ChatProfileContext = {
  self: ChatSelfProfile;
  partner: ChatPartnerProfile | null;
};

type SelfProfileRow = {
  display_name: string | null;
};

type SelfSummaryRow = {
  birth_date: string | null;
  mbti: string | null;
  animal_zodiac: string | null;
  residence: string | null;
  basic_values: string | null;
  partner_impression: string | null;
};

type PartnerSummaryRow = {
  display_name: string | null;
  birth_date: string | null;
  mbti: string | null;
  animal_zodiac: string | null;
  residence: string | null;
  basic_values: string | null;
  gender: string | null;
  birth_year: number | null;
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
};

export async function fetchChatProfileContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ChatProfileContext> {
  const [profileResult, summaryResult, partnerSummaryResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("ai_summaries")
      .select(
        "birth_date, mbti, animal_zodiac, residence, basic_values, partner_impression"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("get_partner_summary"),
  ]);

  const profile = profileResult.data as SelfProfileRow | null;
  const summary = summaryResult.data as SelfSummaryRow | null;
  const partnerRows = partnerSummaryResult.data as PartnerSummaryRow[] | null;
  const partnerRow =
    Array.isArray(partnerRows) && partnerRows.length > 0 ? partnerRows[0] : null;

  return {
    self: {
      displayName: profile?.display_name ?? null,
      birthDate: summary?.birth_date ?? null,
      mbti: summary?.mbti ?? null,
      animalZodiac: summary?.animal_zodiac ?? null,
      residence: summary?.residence ?? null,
      basicValues: summary?.basic_values ?? null,
      partnerImpression: summary?.partner_impression ?? null,
    },
    partner: partnerRow
      ? {
          displayName: partnerRow.display_name,
          birthDate: partnerRow.birth_date,
          mbti: partnerRow.mbti,
          animalZodiac: partnerRow.animal_zodiac,
          residence: partnerRow.residence,
          basicValues: partnerRow.basic_values,
          gender: partnerRow.gender,
          birthYear: partnerRow.birth_year,
          communicationStyle: partnerRow.communication_style,
          comfortablePhrases: partnerRow.comfortable_phrases,
          avoidPhrases: partnerRow.avoid_phrases,
          notes: partnerRow.notes,
        }
      : null,
  };
}
