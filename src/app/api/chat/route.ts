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

type PartnerSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
};

function buildInstructions(partnerSummary: PartnerSummaryRow | null): string {
  if (!partnerSummary) return BASE_INSTRUCTIONS;

  const lines: string[] = [];
  if (partnerSummary.communication_style) {
    lines.push(`・コミュニケーション傾向: ${partnerSummary.communication_style}`);
  }
  if (partnerSummary.comfortable_phrases) {
    lines.push(`・安心しやすい言葉: ${partnerSummary.comfortable_phrases}`);
  }
  if (partnerSummary.avoid_phrases) {
    lines.push(`・避けたい言い方: ${partnerSummary.avoid_phrases}`);
  }
  if (partnerSummary.notes) {
    lines.push(`・その他メモ: ${partnerSummary.notes}`);
  }

  if (lines.length === 0) return BASE_INSTRUCTIONS;

  return (
    BASE_INSTRUCTIONS +
    "\n\n【パートナーについての情報】\n" +
    "以下はパートナーのコミュニケーション傾向です。アドバイスの際に考慮してください。\n" +
    lines.join("\n")
  );
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

  // --- 会話履歴を取得（最新 20 件）---
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

  // --- パートナーの AI 要約メモを取得（SECURITY DEFINER RPC 経由のみ）---
  // ※ ai_summaries を直接 SELECT せず、RPC の鍵穴だけを通す
  // ※ messages.body はパートナー分を一切 SELECT しない
  const { data: partnerSummaryRows } = await supabase.rpc("get_partner_summary");
  const partnerSummary: PartnerSummaryRow | null =
    Array.isArray(partnerSummaryRows) && partnerSummaryRows.length > 0
      ? (partnerSummaryRows[0] as PartnerSummaryRow)
      : null;

  // --- OpenAI Responses API 呼び出し ---
  const input = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.body,
  }));

  let aiText: string;
  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: buildInstructions(partnerSummary),
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
  const { data: newMessageId, error: rpcError } = await supabase.rpc(
    "save_assistant_message",
    {
      consultation_id_param: consultationId,
      body_param: aiText,
    }
  );

  if (rpcError) {
    console.error("[api/chat] save_assistant_message error:", rpcError);
    return NextResponse.json(
      { error: "Failed to save AI response" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: newMessageId as string,
    role: "assistant",
    body: aiText,
    created_at: new Date().toISOString(),
  });
}
