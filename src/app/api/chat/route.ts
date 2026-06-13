import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { encrypt, decryptMessageBody } from "@/lib/encryption";
import { fetchRecentDailyQuestionsForChat } from "@/lib/chat-daily-question-context";
import { fetchChatProfileContext } from "@/lib/chat-profile-context";
import { buildChatInstructions } from "@/lib/chat-instructions";
import {
  buildCasualChatInstructions,
  CASUAL_RETRY_INSTRUCTIONS,
  isCasualConsultation,
  isValidCasualResponse,
} from "@/lib/casual-chat-instructions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 具体メモ抽出用プロンプト
const MEMO_EXTRACTION_INSTRUCTIONS =
  "以下のユーザーメッセージから、パートナーに関する発言の「意味」を1文で抽出してください。\n" +
  "AiAiが理解したこととして、関係性や大切にしていることを言い換えてください。\n\n" +
  "ルール：\n" +
  "- 「〇〇が欲しい」「〇〇に行きたい」など発言の丸写しは禁止\n" +
  "- 固有名詞・場所・商品・条件の列挙は書かない（ペット名は関係性を表す場合のみ可）\n" +
  "- 例: 「小春と3人で住める物件が欲しい」→「小春は家族として大切にしている」\n" +
  "- 例: 「わんわん遊園地に行きたい」→「小春との時間を大切にしたい」\n" +
  "- 複数ある場合は最も関係性に効くものを1つだけ選ぶ\n" +
  "- 抽出できない場合は「なし」とだけ返す\n" +
  "- 推測で補わない（メッセージに明示されているものだけ）\n" +
  "- 1文のみ出力（20〜30文字・前置き不要）";

// インサイト抽出用プロンプト
const INSIGHT_EXTRACTION_INSTRUCTIONS =
  "以下のユーザーメッセージから、「パートナーとの関係性の変化・空気感・感情のパターン」を1文で抽出してください。\n\n" +
  "【抽出すべきもの】\n" +
  "- 関係性の変化（例：「将来を具体的に話せるようになってきた」「感情を素直に伝えられるようになった」）\n" +
  "- 相手への感情や安心感（例：「一緒にいることで落ち着きを感じている」）\n" +
  "- コミュニケーションのパターン変化（例：「以前より本音を話せるようになっている」）\n\n" +
  "【絶対に抽出しないもの】\n" +
  "- 場所・条件・金額などの具体的な事実（例：「調布と御茶ノ水を検討している」）\n" +
  "- TODO・決定事項・次のアクション（例：「物件を3件共有する予定」）\n" +
  "- 一時的な状況や出来事（例：「今週末に会う」「仕事が忙しい」）\n\n" +
  "【ルール】\n" +
  "- 生ログをそのまま引用しない。関係性の意味として言い換える\n" +
  "- 推測で盛らない\n" +
  "- 該当しない場合（事実・TODO・雑談のみ）は「なし」とだけ返す\n" +
  "- 1文のみ（20〜60文字）\n" +
  "- 誤送信・短すぎる内容・意味が曖昧な内容は「なし」と返す";

type PartnerInsightRow = {
  partner_hint_encrypted: string | null;
  partner_hint_iv:        string | null;
  partner_hint_auth_tag:  string | null;
  created_at:             string;
};

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

  // --- スレッドタイトルを取得 ---
  const { data: consultationRow } = await supabase
    .from("consultations")
    .select("title, kind")
    .eq("id", consultationId)
    .maybeSingle();
  const consultationTitle = consultationRow?.title ?? null;
  const isCasual = isCasualConsultation(
    consultationRow?.kind,
    consultationTitle
  );

  // --- 自分の会話履歴を取得（先頭3件 + 最新20件）---
  // ※ パートナーの messages は一切 SELECT しない
  const { data: rawMessages, error: messagesError } = await supabase
    .from("messages")
    .select("id, role, body_encrypted, body_iv, body_auth_tag, created_at")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("[api/chat] messages fetch error:", messagesError);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  if (!rawMessages || rawMessages.length === 0) {
    return NextResponse.json(
      { error: "No messages found" },
      { status: 400 }
    );
  }

  // 先頭3件 + 最新20件を合成（重複排除）
  const first3 = rawMessages.slice(0, 3);
  const last20 = rawMessages.slice(-50);
  const mergedIds = new Set<string>();
  const merged = [...first3, ...last20].filter((row) => {
    if (mergedIds.has(row.id)) return false;
    mergedIds.add(row.id);
    return true;
  });

  const messages = merged.map((row) => ({
    role: row.role as string,
    body: decryptMessageBody(row),
  }));

  // --- 相談者・パートナーのプロフィールとふたり質問履歴を取得 ---
  const [profileContext, partnerInsightResult, dailyQuestionRounds] =
    await Promise.all([
      fetchChatProfileContext(supabase, user.id),
      supabase.rpc("get_partner_insights", { limit_count: 30 }),
      fetchRecentDailyQuestionsForChat(supabase, 5),
    ]);

  // --- パートナーの時系列ヒント（SECURITY DEFINER RPC 経由のみ）---
  // ※ relationship_insights に authenticated は直接アクセス不可
  const partnerInsightRows = partnerInsightResult.data;
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
    const instructions = isCasual
      ? buildCasualChatInstructions(
          profileContext,
          partnerInsights,
          dailyQuestionRounds
        )
      : buildChatInstructions(
          profileContext,
          partnerInsights,
          consultationTitle,
          dailyQuestionRounds
        );

    const aiResponse = await openai.responses.create(
      {
        model: "gpt-5.5",
        instructions,
        input,
      },
      { signal: request.signal }
    );
    aiText = aiResponse.output_text?.trim() ?? "";
    if (!aiText) throw new Error("empty response from OpenAI");

    if (isCasual && !isValidCasualResponse(aiText)) {
      const retryResponse = await openai.responses.create(
        {
          model: "gpt-5.5",
          instructions: CASUAL_RETRY_INSTRUCTIONS,
          input: [
            ...input,
            { role: "assistant", content: aiText },
            {
              role: "user",
              content:
                "長すぎます。2〜3文だけ。助言なし。最後は必ず「？」で終わる質問1つにしてください。",
            },
          ],
        },
        { signal: request.signal }
      );
      const retryText = retryResponse.output_text?.trim() ?? "";
      if (retryText && isValidCasualResponse(retryText)) {
        aiText = retryText;
      } else if (retryText) {
        aiText = ensureCasualQuestionEnding(retryText);
      } else {
        aiText = ensureCasualQuestionEnding(aiText);
      }
    }
  } catch (err) {
    console.error("[api/chat] OpenAI error:", err);
    return NextResponse.json(
      { error: "AI response failed" },
      { status: 502 }
    );
  }

  // --- AI 返答を暗号化して DB へ保存（SECURITY DEFINER RPC）---
  let aiPayload: ReturnType<typeof encrypt>;
  try {
    aiPayload = encrypt(aiText);
  } catch (err) {
    console.error("[api/chat] encrypt AI response error:", err);
    return NextResponse.json(
      { error: "Encryption failed" },
      { status: 500 }
    );
  }

  const { data: newMessageId, error: saveError } = await supabase.rpc(
    "save_assistant_message",
    {
      consultation_id_param: consultationId,
      body_encrypted_param:  aiPayload.encrypted,
      body_iv_param:         aiPayload.iv,
      body_auth_tag_param:   aiPayload.authTag,
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
    extractAndSaveMemo(supabase, latestUserMessage.body).catch((err) => {
      console.error("[api/chat] memo extraction failed (non-fatal):", err);
    });
    if (!isCasual) {
      extractAndSaveInsight(supabase, latestUserMessage.body).catch((err) => {
        console.error("[api/chat] insight extraction failed (non-fatal):", err);
      });
    }
  }

  return NextResponse.json({
    id: newMessageId as string,
    role: "assistant",
    body: aiText,
    created_at: new Date().toISOString(),
  });
}

function ensureCasualQuestionEnding(text: string): string {
  let trimmed = text.trim().replace(/^>+\s?/gm, "").replace(/\n+/g, " ");
  if (trimmed.length > 120) {
    const parts = trimmed.split(/(?<=[。！？?!])/);
    trimmed = parts.slice(0, 2).join("").trim() || trimmed.slice(0, 80);
  }
  if (/[?？]$/.test(trimmed)) return trimmed;
  const withoutAdvice = trimmed
    .replace(/ポイントは[\s\S]+/, "")
    .replace(/伝えましょう[\s\S]+/, "")
    .trim();
  const base = withoutAdvice.split(/[。！？?!]/)[0]?.trim() || withoutAdvice;
  return `${base}。今どんな気持ち？`;
}

// 具体メモ抽出・保存（fire-and-forget）
async function extractAndSaveMemo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userMessageBody: string
): Promise<void> {
  const response = await openai.responses.create({
    model: "gpt-5.5",
    instructions: MEMO_EXTRACTION_INSTRUCTIONS,
    input: userMessageBody,
  });

  const content = response.output_text?.trim();
  if (!content || content === "なし") return;

  const { error } = await supabase.rpc("save_partner_memo", {
    content_param: content,
  });

  if (error) {
    console.error("[api/chat] save_partner_memo error:", error);
  }
}

// インサイト抽出・保存（AI 返答返却後にバックグラウンドで実行）
async function extractAndSaveInsight(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userMessageBody: string
): Promise<void> {
  const extractResponse = await openai.responses.create({
    model: "gpt-5.5",
    instructions: INSIGHT_EXTRACTION_INSTRUCTIONS,
    input: userMessageBody,
  });

  const hint = extractResponse.output_text?.trim();
  if (!hint || hint === "なし") return;

  const payload = encrypt(hint);
  const { error } = await supabase.rpc("save_insight", {
    partner_hint_encrypted_param: payload.encrypted,
    partner_hint_iv_param:        payload.iv,
    partner_hint_auth_tag_param:  payload.authTag,
  });

  if (error) {
    console.error("[api/chat] save_insight error:", error);
  }
}
