import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MIN_INSIGHTS_TO_COMPACT = 5;

type InsightRow = {
  id:           string;
  partner_hint: string;
  created_at:   string;
};

type AiSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases:       string | null;
  notes:               string | null;
  gender:              string | null;
  birth_year:          number | null;
  mbti:                string | null;
  basic_values:        string | null;
};

type CompactedFields = {
  communication_style: string;
  comfortable_phrases: string;
  avoid_phrases:       string;
  notes:               string;
};

function buildCompactionPrompt(
  current: AiSummaryRow | null,
  insights: InsightRow[]
): string {
  const existingBlock = current
    ? [
        `communication_style: ${current.communication_style ?? "（未設定）"}`,
        `comfortable_phrases: ${current.comfortable_phrases  ?? "（未設定）"}`,
        `avoid_phrases:       ${current.avoid_phrases        ?? "（未設定）"}`,
        `notes:               ${current.notes                ?? "（未設定）"}`,
      ].join("\n")
    : "（まだ設定なし）";

  const insightLines = insights
    .map((i) => `・${i.partner_hint}`)
    .join("\n");

  return (
    "あなたはカップル関係のAIアドバイザーです。\n" +
    "以下の「最近の関係メモ」を分析し、既存の長期プロフィールと統合してください。\n\n" +
    "【既存の長期プロフィール】\n" +
    existingBlock +
    "\n\n【最近の関係メモ（新しい順）】\n" +
    insightLines +
    "\n\n" +
    "ルール：\n" +
    "- 生ログや「〜と言っていた」という表現は絶対に使わない\n" +
    "- 既存の情報と新しいメモを自然に統合する\n" +
    "- 各フィールドは3文以内に収める\n" +
    "- 情報がない場合は空文字にする\n" +
    "- 必ず以下のJSONのみを返す（説明文は不要）：\n" +
    '{"communication_style":"...","comfortable_phrases":"...","avoid_phrases":"...","notes":"..."}'
  );
}

export async function POST() {
  // --- 認証 ---
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- 自分の insights を取得（SECURITY DEFINER RPC 経由のみ）---
  const { data: insightRows, error: insightsError } = await supabase.rpc(
    "get_own_insights",
    { limit_count: 30 }
  );

  if (insightsError) {
    console.error("[compact] get_own_insights error:", insightsError);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }

  const insights = (insightRows ?? []) as InsightRow[];

  if (insights.length < MIN_INSIGHTS_TO_COMPACT) {
    return NextResponse.json({
      compacted: false,
      reason: `insights が ${MIN_INSIGHTS_TO_COMPACT} 件未満のためスキップしました（現在 ${insights.length} 件）`,
    });
  }

  // --- 現在の ai_summaries を取得（gender/birth_year/mbti を保持するため）---
  // ※ RLS: user_id = auth.uid() で自分のレコードのみ読める
  const { data: currentSummary } = await supabase
    .from("ai_summaries")
    .select(
      "communication_style, comfortable_phrases, avoid_phrases, notes, gender, birth_year, mbti, basic_values"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // --- OpenAI でコンパクション ---
  let compacted: CompactedFields;
  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions:
        "あなたはカップル関係のAIアドバイザーです。指示に従い、必ずJSONのみを返してください。",
      input: buildCompactionPrompt(
        currentSummary as AiSummaryRow | null,
        insights
      ),
      text: { format: { type: "json_object" } },
    });

    const raw = response.output_text;
    if (!raw) throw new Error("empty response from OpenAI");

    compacted = JSON.parse(raw) as CompactedFields;

    if (typeof compacted.communication_style !== "string") {
      throw new Error("invalid JSON shape from OpenAI");
    }
  } catch (err) {
    console.error("[compact] OpenAI error:", err);
    return NextResponse.json(
      { error: "AI compaction failed" },
      { status: 502 }
    );
  }

  // --- upsert_ai_summary RPC で ai_summaries を更新 ---
  // gender / birth_year / mbti / basic_values は既存値を維持
  const existing = (currentSummary as AiSummaryRow | null) ?? {
    gender: null, birth_year: null, mbti: null, basic_values: null,
  };

  const { error: upsertError } = await supabase.rpc("upsert_ai_summary", {
    communication_style_param: compacted.communication_style || null,
    comfortable_phrases_param: compacted.comfortable_phrases || null,
    avoid_phrases_param:       compacted.avoid_phrases       || null,
    notes_param:               compacted.notes               || null,
    gender_param:              existing.gender,
    birth_year_param:          existing.birth_year,
    mbti_param:                existing.mbti,
    basic_values_param:        existing.basic_values,
  });

  if (upsertError) {
    console.error("[compact] upsert_ai_summary error:", upsertError);
    return NextResponse.json(
      { error: "Failed to save compacted summary" },
      { status: 500 }
    );
  }

  // --- 処理済み insights を削除 ---
  // insights は created_at DESC で取得しているので最後の要素が最古
  const oldestCreatedAt = insights[insights.length - 1].created_at;

  const { data: deletedCount, error: deleteError } = await supabase.rpc(
    "delete_compacted_insights",
    { before_ts: oldestCreatedAt }
  );

  if (deleteError) {
    // 削除に失敗してもコンパクション自体は成功しているので警告のみ
    console.warn("[compact] delete_compacted_insights error:", deleteError);
  }

  return NextResponse.json({
    compacted:     true,
    processedCount: insights.length,
    deletedCount:  deletedCount ?? 0,
    updatedFields: {
      communication_style: compacted.communication_style,
      comfortable_phrases: compacted.comfortable_phrases,
      avoid_phrases:       compacted.avoid_phrases,
      notes:               compacted.notes,
    },
  });
}
