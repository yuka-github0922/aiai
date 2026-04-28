import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_INSTRUCTIONS =
  "あなたはパートナーとの関係に寄り添うAIアドバイザーです。" +
  "ユーザーの悩みに共感し、具体的で温かいアドバイスを日本語で提供してください。" +
  "カップルのすれ違いをやさしくほどき、パートナーとの関係をより良くするアドバイスを提供してください。" +
  "返答は簡潔にまとめ、押しつけがましくならないようにしてください。";

// インサイト抽出用プロンプト
const INSIGHT_EXTRACTION_INSTRUCTIONS =
  "以下のユーザーメッセージから、その人が本音として感じていることや望んでいることを1文で要約してください。\n" +
  "ルール：\n" +
  "- 生ログをそのまま引用しない\n" +
  "- 内容を言い換えて自然な日本語で要約する\n" +
  "- 過度に一般化しない（例：〜しやすい は使わない）\n" +
  "- 推測で盛らない\n" +
  "- 感情・希望・不満などがある場合のみ抽出\n" +
  "- 該当しない場合は「なし」と返す\n" +
  "- 1文のみ（20〜60文字）\n" +
  "保存する価値がない場合、誤送信・短すぎる内容・意味が曖昧な内容の場合は、必ず「なし」とだけ返してください。";

type PartnerSummaryRow = {
  communication_style: string | null;
  comfortable_phrases:  string | null;
  avoid_phrases:        string | null;
  notes:                string | null;
  gender:               string | null;
  birth_year:           number | null;
  mbti:                 string | null;
  basic_values:         string | null;
};

type PartnerInsightRow = {
  partner_hint: string;
  created_at:   string;
};

function buildInstructions(
  partnerSummary: PartnerSummaryRow | null,
  partnerInsights: PartnerInsightRow[]
): string {
  let instructions = BASE_INSTRUCTIONS;

  // --- 固定プロフィール ---
  const profileLines: string[] = [];
  if (partnerSummary) {
    if (partnerSummary.gender)
      profileLines.push(`・性別: ${partnerSummary.gender}`);
    if (partnerSummary.birth_year)
      profileLines.push(`・生まれ年: ${partnerSummary.birth_year}年頃`);
    if (partnerSummary.mbti)
      profileLines.push(`・MBTI: ${partnerSummary.mbti}`);
    if (partnerSummary.basic_values)
      profileLines.push(`・基本価値観: ${partnerSummary.basic_values}`);
    if (partnerSummary.communication_style)
      profileLines.push(`・コミュニケーション傾向: ${partnerSummary.communication_style}`);
    if (partnerSummary.comfortable_phrases)
      profileLines.push(`・安心しやすい言葉: ${partnerSummary.comfortable_phrases}`);
    if (partnerSummary.avoid_phrases)
      profileLines.push(`・避けたい言い方: ${partnerSummary.avoid_phrases}`);
    if (partnerSummary.notes)
      profileLines.push(`・その他メモ: ${partnerSummary.notes}`);
  }

  if (profileLines.length > 0) {
    instructions +=
      "\n\n【パートナーの固定プロフィール】\n" + profileLines.join("\n");
  }

  // --- 最近の時系列ヒント ---
  if (partnerInsights.length > 0) {
    const insightLines = partnerInsights.map((i) => `・${i.partner_hint}`);
    instructions +=
      "\n\n【パートナーの最近の傾向（最新順）】\n" +
      "※ 必ず守ること：「パートナーがこう言っていた」「相手がこう話していた」という表現は絶対に使わない。" +
      "以下のヒントをさりげなくアドバイスに活かすだけにすること。\n" +
      insightLines.join("\n");
  }

  return instructions;
}

export async function POST(request: NextRequest) {
  // --- 認証 ---
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- リクエスト検証 ---
  let consultationId: string;
  try {
    const body = await request.json();
    consultationId = body.consultationId;
    if (!consultationId) throw new Error("missing consultationId");
  } catch {
    return NextResponse.json(
      { error: "consultationId is required" },
      { status: 400 }
    );
  }

  // --- 自分の会話履歴を取得（最新 20 件）---
  // ※ パートナーの messages.body は一切 SELECT しない
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("role, body")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (messagesError) {
    console.error("[api/chat] messages fetch error:", messagesError);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: "No messages found" },
      { status: 400 }
    );
  }

  // --- パートナーの固定プロフィールを取得（SECURITY DEFINER RPC 経由のみ）---
  const { data: partnerSummaryRows } = await supabase.rpc("get_partner_summary");
  const partnerSummary: PartnerSummaryRow | null =
    Array.isArray(partnerSummaryRows) && partnerSummaryRows.length > 0
      ? (partnerSummaryRows[0] as PartnerSummaryRow)
      : null;

  // --- パートナーの時系列ヒントを取得（SECURITY DEFINER RPC 経由のみ）---
  // ※ relationship_insights に authenticated は直接アクセス不可
  const { data: partnerInsightRows } = await supabase.rpc(
    "get_partner_insights",
    { limit_count: 10 }
  );
  const partnerInsights: PartnerInsightRow[] = Array.isArray(partnerInsightRows)
    ? (partnerInsightRows as PartnerInsightRow[])
    : [];

  // --- OpenAI Responses API：AI 返答生成 ---
  const input = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.body,
  }));

  let aiText: string;
  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: buildInstructions(partnerSummary, partnerInsights),
      input,
    });
    aiText = aiResponse.output_text;
    if (!aiText) throw new Error("empty response from OpenAI");
  } catch (err) {
    console.error("[api/chat] OpenAI error:", err);
    return NextResponse.json(
      { error: "AI response failed" },
      { status: 502 }
    );
  }

  // --- AI 返答を DB へ保存（SECURITY DEFINER RPC）---
  const { data: newMessageId, error: saveError } = await supabase.rpc(
    "save_assistant_message",
    {
      consultation_id_param: consultationId,
      body_param: aiText,
    }
  );

  if (saveError) {
    console.error("[api/chat] save_assistant_message error:", saveError);
    return NextResponse.json(
      { error: "Failed to save AI response" },
      { status: 500 }
    );
  }

  // --- インサイト抽出（最新のユーザーメッセージから）---
  // ※ 生ログ引用なし・AI 変換済みヒントのみを save_insight RPC で保存
  // ※ エラーになっても AI 返答の返却は妨げない（fire-and-forget）
  const latestUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (latestUserMessage) {
    extractAndSaveInsight(supabase, latestUserMessage.body).catch((err) => {
      console.error("[api/chat] insight extraction failed (non-fatal):", err);
    });
  }

  return NextResponse.json({
    id: newMessageId as string,
    role: "assistant",
    body: aiText,
    created_at: new Date().toISOString(),
  });
}

// インサイト抽出・保存（AI 返答返却後にバックグラウンドで実行）
async function extractAndSaveInsight(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userMessageBody: string
): Promise<void> {
  const extractResponse = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions: INSIGHT_EXTRACTION_INSTRUCTIONS,
    input: userMessageBody,
  });

  const hint = extractResponse.output_text?.trim();
  if (!hint || hint === "なし") return;

  const { error } = await supabase.rpc("save_insight", {
    partner_hint_param: hint,
  });

  if (error) {
    console.error("[api/chat] save_insight error:", error);
  }
}
