import { createClient } from "@/lib/supabase/client";
import type { ProfileOnboardingFieldKey } from "./profile-onboarding-types";

type SaveResult = { ok: true } | { ok: false; error: string };

type AnniversaryPayload = {
  title: string;
  date: string;
};

async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type SummaryRpcParams = {
  communication_style_param: string | null;
  comfortable_phrases_param: string | null;
  avoid_phrases_param: string | null;
  notes_param: string | null;
  gender_param: string | null;
  birth_year_param: number | null;
  birth_date_param: string | null;
  mbti_param: string | null;
  basic_values_param: string | null;
  animal_zodiac_param: string | null;
  residence_param: string | null;
  partner_impression_param: string | null;
};

type SummaryPartialUpdate = Partial<SummaryRpcParams>;

async function fetchSummaryRpcParams(
  userId: string
): Promise<SummaryRpcParams> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ai_summaries")
    .select(
      "communication_style, comfortable_phrases, avoid_phrases, notes, gender, birth_year, birth_date, mbti, basic_values, animal_zodiac, residence, partner_impression"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[profile-onboarding] fetch ai_summaries:", error);
  }

  return {
    communication_style_param: data?.communication_style ?? null,
    comfortable_phrases_param: data?.comfortable_phrases ?? null,
    avoid_phrases_param: data?.avoid_phrases ?? null,
    notes_param: data?.notes ?? null,
    gender_param: data?.gender ?? null,
    birth_year_param: data?.birth_year ?? null,
    birth_date_param: data?.birth_date ?? null,
    mbti_param: data?.mbti ?? null,
    basic_values_param: data?.basic_values ?? null,
    animal_zodiac_param: data?.animal_zodiac ?? null,
    residence_param: data?.residence ?? null,
    partner_impression_param: data?.partner_impression ?? null,
  };
}

async function upsertSummaryFields(
  userId: string,
  fields: SummaryPartialUpdate
): Promise<SaveResult> {
  const supabase = createClient();
  const current = await fetchSummaryRpcParams(userId);
  const { error } = await supabase.rpc("upsert_ai_summary", {
    ...current,
    ...fields,
  });

  if (error) {
    console.error("[profile-onboarding] upsert_ai_summary:", error);
    if (error.message.includes("couple not found")) {
      return {
        ok: false,
        error: "カップルに所属していないため保存できません",
      };
    }
    return { ok: false, error: "保存に失敗しました" };
  }
  return { ok: true };
}

function parseAnniversaryPayload(value: string): AnniversaryPayload | null {
  try {
    const parsed = JSON.parse(value) as AnniversaryPayload;
    if (!parsed.title?.trim() || !parsed.date) return null;
    return { title: parsed.title.trim(), date: parsed.date };
  } catch {
    return null;
  }
}

export async function saveProfileOnboardingAnswer(
  key: ProfileOnboardingFieldKey,
  value: string
): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const trimmed = value.trim();
  const supabase = createClient();

  switch (key) {
    case "display_name": {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed || null })
        .eq("id", userId);
      if (error) return { ok: false, error: "名前の保存に失敗しました" };
      return { ok: true };
    }
    case "partner_nickname": {
      const { error } = await supabase
        .from("profiles")
        .update({ partner_nickname: trimmed || null })
        .eq("id", userId);
      if (error) return { ok: false, error: "呼び名の保存に失敗しました" };
      return { ok: true };
    }
    case "birth_date":
      return upsertSummaryFields(userId, {
        birth_date_param: trimmed || null,
      });
    case "residence":
      return upsertSummaryFields(userId, {
        residence_param: trimmed || null,
      });
    case "mbti":
      return upsertSummaryFields(userId, {
        mbti_param: trimmed || null,
      });
    case "animal_zodiac":
      return upsertSummaryFields(userId, {
        animal_zodiac_param: trimmed || null,
      });
    case "basic_values":
      return upsertSummaryFields(userId, {
        basic_values_param: trimmed || null,
      });
    case "communication_style":
      return upsertSummaryFields(userId, {
        communication_style_param: trimmed || null,
      });
    case "comfortable_phrases":
      return upsertSummaryFields(userId, {
        comfortable_phrases_param: trimmed || null,
      });
    case "avoid_phrases":
      return upsertSummaryFields(userId, {
        avoid_phrases_param: trimmed || null,
      });
    case "notes":
      return upsertSummaryFields(userId, {
        notes_param: trimmed || null,
      });
    case "partner_impression":
      return upsertSummaryFields(userId, {
        partner_impression_param: trimmed || null,
      });
    case "anniversary": {
      const payload = parseAnniversaryPayload(trimmed);
      if (!payload) {
        return { ok: false, error: "記念日の名前と日付を入力してください" };
      }
      const { error } = await supabase.rpc("create_anniversary", {
        title_param: payload.title,
        date_param: payload.date,
      });
      if (error) {
        console.error("[profile-onboarding] create_anniversary:", error);
        return { ok: false, error: "記念日の登録に失敗しました" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: "不明な項目です" };
  }
}

export async function skipProfileOnboardingField(
  key: ProfileOnboardingFieldKey
): Promise<SaveResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "ログインが必要です" };

  const supabase = createClient();
  const { error: rpcError } = await supabase.rpc(
    "append_profile_onboarding_skipped",
    { p_field: key }
  );

  if (!rpcError) {
    return { ok: true };
  }

  console.warn("[profile-onboarding] skip RPC failed, trying direct update:", rpcError);

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("profile_onboarding_skipped")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    console.error("[profile-onboarding] skip read:", readError);
    return { ok: false, error: "スキップの保存に失敗しました" };
  }

  const current = (profile?.profile_onboarding_skipped as string[] | null) ?? [];
  const nextSkipped = current.includes(key) ? current : [...current, key];

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ profile_onboarding_skipped: nextSkipped })
    .eq("id", userId);

  if (updateError) {
    console.error("[profile-onboarding] skip update:", updateError);
    return { ok: false, error: "スキップの保存に失敗しました" };
  }

  return { ok: true };
}

export async function dismissProfileOnboarding(): Promise<SaveResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("dismiss_profile_onboarding");
  if (error) {
    console.error("[profile-onboarding] dismiss:", error);
    return { ok: false, error: "保存に失敗しました" };
  }
  return { ok: true };
}

export async function completeProfileOnboarding(): Promise<SaveResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("complete_profile_onboarding");
  if (error) {
    console.error("[profile-onboarding] complete:", error);
    return { ok: false, error: "完了の保存に失敗しました" };
  }
  return { ok: true };
}
