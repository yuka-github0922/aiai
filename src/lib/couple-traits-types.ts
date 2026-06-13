/** プロンプト改訂時にインクリメント。キャッシュの自動再生成に使う */
export const COUPLE_TRAITS_PROMPT_VERSION = "smile_intro_v2";

/** プロンプト改訂時にインクリメント。観察レポートの自動再生成に使う */
export const COUPLE_OBSERVATIONS_PROMPT_VERSION = "observation_v1";

export type CoupleTraitMember = {
  userId: string;
  name: string;
  traits: string[];
};

export type CoupleTraitsAiResult = {
  self: { name: string; traits: string[] };
  partner: { name: string; traits: string[] } | null;
};

export type CachedCoupleTraitMember = {
  user_id: string;
  name: string;
  traits: string[];
  /** AiAi予想の似顔絵（data URL）。カップル共通キャッシュに保存 */
  avatar_url?: string | null;
};

export type CachedCoupleTraitsRow = {
  couple_id: string;
  self_traits: CachedCoupleTraitMember;
  partner_traits: CachedCoupleTraitMember | null;
  generated_at: string;
  source_summary: Record<string, unknown> | null;
  model: string;
  recent_notices?: CachedCoupleObservationNotice[];
  observations_generated_at?: string | null;
  observations_model?: string | null;
};

export type CachedCoupleObservationNotice = {
  emoji: string;
  label: string;
};

export type CoupleTraitsMemoMember = {
  user_id: string;
  display_name: string | null;
  memos: {
    content: string;
    created_at: string;
  }[];
};

export type CoupleTraitsProfileMember = {
  user_id: string;
  display_name: string | null;
  gender: string | null;
  basic_values: string | null;
  communication_style: string | null;
  partner_impression: string | null;
};

export type CoupleTraitsInsightMember = {
  user_id: string;
  display_name: string | null;
  insights: {
    partner_hint_encrypted: string;
    partner_hint_iv: string;
    partner_hint_auth_tag: string;
    created_at: string;
  }[];
};

export type CoupleTraitsGenerationContext = {
  members: {
    userId: string;
    name: string;
    profile: {
      gender: string | null;
      basicValues: string | null;
      communicationStyle: string | null;
      partnerImpressionAboutOther: string | null;
    };
    insights: string[];
    memos: string[];
  }[];
  dailyQuestions: {
    question: string;
    answers: { userId: string; name: string; answer: string; guess: string }[];
    understandingCoupleScore: number | null;
  }[];
};
