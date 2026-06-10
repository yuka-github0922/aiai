import { createClient } from "@/lib/supabase/server";
import { resolvePartnerHint } from "@/lib/encryption";
import { interpretMemosForDisplay } from "@/lib/interpret-memos-for-display";
import { generateNudgeWithAI, type InsightRow, type AnniversaryRow } from "@/lib/nudge";
import type { MemoForMemory } from "@/lib/ai-memories";
import { redirect } from "next/navigation";

export type CoupleRow = {
  id: string;
  invite_code: string;
  created_at: string;
};

export type MemberRow = {
  user_id: string;
  joined_at: string;
};

export type CoupleAppContext = {
  user: { id: string; email?: string };
  membership: { couple_id: string; joined_at: string };
  couple: CoupleRow | null;
  partner: MemberRow | null;
  selfName: string;
  partnerName: string;
  partnerNickname: string | null;
  anniversaries: AnniversaryRow[];
  memos: MemoForMemory[];
  memoCount: number;
  insights: InsightRow[];
  interpretedMemoLabels: Map<string, string>;
  nudgeMessage: string;
  summaryTags: string[];
  mbti: string | null;
  communicationStyle: string | null;
  consultationCount: number;
};

type RawInsightRow = {
  partner_hint?: string | null;
  partner_hint_encrypted?: string | null;
  partner_hint_iv?: string | null;
  partner_hint_auth_tag?: string | null;
  created_at: string;
};

function resolveSelfName(
  displayName: string | null | undefined,
  email: string | undefined
): string {
  if (displayName?.trim()) return displayName.trim();
  const local = email?.split("@")[0];
  return local?.trim() || "あなた";
}

export async function requireCoupleAppContext(): Promise<CoupleAppContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, joined_at, couples(id, invite_code, created_at)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const couple = membership.couples as unknown as CoupleRow | null;

  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id, joined_at")
    .eq("couple_id", membership.couple_id);

  const partner =
    (members as MemberRow[] | null)?.find((m) => m.user_id !== user.id) ?? null;

  const [
    { data: aiSummary },
    { data: myProfile },
    { data: rawInsights },
    { data: rawAnniversaries },
    { data: rawMemos },
    { count: memoCount },
    { count: consultationCount },
  ] = await Promise.all([
    supabase
      .from("ai_summaries")
      .select("gender, birth_year, mbti, basic_values, communication_style")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("partner_nickname, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("get_partner_insights_for_nudge", { limit_param: 100 }),
    supabase
      .from("anniversaries")
      .select("title, date")
      .eq("couple_id", membership.couple_id),
    supabase
      .from("partner_memos")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("partner_memos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const anniversaries = (rawAnniversaries ?? []) as AnniversaryRow[];
  const memos = (rawMemos ?? []) as MemoForMemory[];

  const decryptedInsights: InsightRow[] = (rawInsights ?? [])
    .map((r: RawInsightRow) => ({
      partner_hint: resolvePartnerHint(r),
      created_at: r.created_at,
    }))
    .filter((i) => i.partner_hint.trim().length > 0);

  const [nudgeMessage, interpretedMemoLabels] = await Promise.all([
    generateNudgeWithAI(decryptedInsights, anniversaries, memos),
    interpretMemosForDisplay(memos),
  ]);

  const profile = myProfile as {
    partner_nickname: string | null;
    display_name: string | null;
  } | null;

  const partnerNickname = profile?.partner_nickname ?? null;
  const selfName = resolveSelfName(profile?.display_name, user.email);
  const partnerName = partnerNickname?.trim() || "パートナー";

  const genderLabel =
    aiSummary?.gender === "male"
      ? "男性"
      : aiSummary?.gender === "female"
        ? "女性"
        : null;

  const summaryTags = [
    aiSummary?.mbti,
    genderLabel,
    aiSummary?.birth_year ? `${aiSummary.birth_year}年生` : null,
  ].filter((tag): tag is string => !!tag);

  return {
    user: { id: user.id, email: user.email },
    membership: {
      couple_id: membership.couple_id,
      joined_at: membership.joined_at as string,
    },
    couple,
    partner,
    selfName,
    partnerName,
    partnerNickname,
    anniversaries,
    memos,
    memoCount: memoCount ?? 0,
    insights: decryptedInsights,
    interpretedMemoLabels,
    nudgeMessage,
    summaryTags,
    mbti: aiSummary?.mbti ?? null,
    communicationStyle: aiSummary?.communication_style ?? null,
    consultationCount: consultationCount ?? 0,
  };
}

export function memosWithLabels(
  memos: MemoForMemory[],
  labels: Map<string, string>
): MemoForMemory[] {
  return memos.map((memo) => ({
    ...memo,
    displayLabel: labels.get(memo.id ?? memo.created_at),
  }));
}
