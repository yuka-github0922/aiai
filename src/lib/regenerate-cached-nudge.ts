import { resolvePartnerHint } from "@/lib/encryption";
import {
  generateNudgeWithAI,
  type InsightRow,
  type AnniversaryRow,
  type MemoRow,
} from "@/lib/nudge";

type RawInsightRow = {
  partner_hint?: string | null;
  partner_hint_encrypted?: string | null;
  partner_hint_iv?: string | null;
  partner_hint_auth_tag?: string | null;
  created_at: string;
};

export type RegenerateCachedNudgeResult = {
  saved: boolean;
  reason?: string;
};

/**
 * insight / memo / 記念日をもとに AI ナッジを生成し cached_nudges に保存する。
 * AI 生成成功時のみ upsert（fallback は既存キャッシュを上書きしない）。
 */
export async function regenerateCachedNudge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<RegenerateCachedNudgeResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("[regenerateCachedNudge] skip: no user");
    return { saved: false, reason: "no_user" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("[regenerateCachedNudge] couple_members error:", membershipError);
    return { saved: false, reason: "membership_error" };
  }
  if (!membership?.couple_id) {
    console.log("[regenerateCachedNudge] skip: no couple");
    return { saved: false, reason: "no_couple" };
  }

  const coupleId = membership.couple_id as string;

  const [
    { data: rawInsights, error: insightsError },
    { data: rawAnniversaries, error: anniversariesError },
    { data: rawMemos, error: memosError },
  ] = await Promise.all([
    supabase.rpc("get_partner_insights_for_nudge", { limit_param: 5 }),
    supabase.from("anniversaries").select("title, date").eq("couple_id", coupleId),
    supabase
      .from("partner_memos")
      .select("content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (insightsError) {
    console.error("[regenerateCachedNudge] get_partner_insights_for_nudge error:", insightsError);
  }
  if (anniversariesError) {
    console.error("[regenerateCachedNudge] anniversaries error:", anniversariesError);
  }
  if (memosError) {
    console.error("[regenerateCachedNudge] partner_memos error:", memosError);
  }

  const decryptedInsights: InsightRow[] = ((rawInsights ?? []) as RawInsightRow[])
    .map((r) => ({
      partner_hint: resolvePartnerHint(r),
      created_at: r.created_at,
    }))
    .filter((i) => i.partner_hint.trim().length > 0);

  const anniversaries = (rawAnniversaries ?? []) as AnniversaryRow[];
  const memos = (rawMemos ?? []) as MemoRow[];

  console.log("[regenerateCachedNudge] inputs:", {
    userId: user.id,
    insights: decryptedInsights.length,
    memos: memos.length,
    anniversaries: anniversaries.length,
  });

  const result = await generateNudgeWithAI(decryptedInsights, anniversaries, memos);

  if (!result.fromAI) {
    console.log("[regenerateCachedNudge] skip upsert (fallback, not saved):", {
      skipReason: result.skipReason,
    });
    return { saved: false, reason: result.skipReason ?? "fallback" };
  }

  const { error: upsertError } = await supabase.rpc("upsert_cached_nudge", {
    body_param: result.body,
  });

  if (upsertError) {
    console.error("[regenerateCachedNudge] upsert_cached_nudge error:", upsertError);
    return { saved: false, reason: "upsert_error" };
  }

  console.log("[regenerateCachedNudge] OpenAI success, cached_nudges updated");
  return { saved: true };
}
