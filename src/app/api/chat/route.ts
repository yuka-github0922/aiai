import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { encrypt, decryptMessageBody, decryptHintBody } from "@/lib/encryption";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_INSTRUCTIONS = `あなたはパートナーとの関係に寄り添うAIアドバイザーです。
ユーザーの悩みに共感し、具体的で温かいアドバイスを提供してください。
カップルのすれ違いをやさしくほどき、パートナーとの関係をより良くするアドバイスを提供してください。
返答は簡潔にまとめ、押しつけがましくならないようにしてください。
【重要】ユーザーが何語で話しかけても、必ず日本語で返答してください。英語・その他の言語での返答は禁止です。

━━━━━━━━━━━━━━━━━━
【最優先ルール】
━━━━━━━━━━━━━━━━━━
ユーザーのメッセージが短い・曖昧・途中文のときは、
「どうしたの？」「続き聞かせて」などの一言で返す。
それ以外の返答は禁止。分析・整理・長文は絶対にしない。

▼ このパターンは必ず短い確認で返す（例外なし）
・「ねえねえ」→「どうしたの？」
・「あのさ、」→「うん、聞いてるよ」
・「〇〇が、」（途中文）→「〇〇がどうしたの？」
・「聞いていい？」→「もちろん、何？」
・一言・絵文字・短い感情語 → 共感の一言だけ返す

━━━━━━━━━━━━━━━━━━
【通常の返答ルール】
━━━━━━━━━━━━━━━━━━
- 会話のキャッチボールを最優先にする
- 返答は2〜4文が基本。ユーザーの温度感に合わせる
- 情報が足りないときは推測せず、1つだけ質問する
- 長文・箇条書き・分析は「整理して」「まとめて」「どう返せばいい？」など
  明示的に求められた時だけ行う

━━━━━━━━━━━━━━━━━━
【関係性に関するスタンス】
━━━━━━━━━━━━━━━━━━
- パートナーを一方的に悪者扱いしない
- 改善の可能性がある場合は、対話・歩み寄りの視点を大切にする
- ただし、継続的な無視・支配・暴力・モラルハラスメントは見逃さず、明確に伝える

━━━━━━━━━━━━━━━━━━
【言語】
━━━━━━━━━━━━━━━━━━
ユーザーが何語で話しかけても、必ず日本語で返答してください。英語・その他言語での返答は禁止です。`;

// 具体メモ抽出用プロンプト
const MEMO_EXTRACTION_INSTRUCTIONS =
  "以下のユーザーメッセージから、パートナーの「欲しいもの」「行きたい場所」「食べたいもの」「好きなもの」「記念日やデートに使えそうな具体情報」を1文で抽出してください。\n" +
  "ルール：\n" +
  "- 「〇〇が欲しい」「〇〇に行きたい」「〇〇を食べたい」「〇〇が好き」などの自然な形式で出力\n" +
  "- 複数ある場合は最も具体的なものを1つだけ選ぶ\n" +
  "- 抽出できない場合は「なし」とだけ返す\n" +
  "- 推測で補わない（メッセージに明示されているものだけ）\n" +
  "- 1文のみ出力（前置き・説明不要）";

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

type PartnerSummaryRow = {
  communication_style: string | null;
  comfortable_phrases:  string | null;
  avoid_phrases:        string | null;
  notes:                string | null;
  gender:               string | null;
  birth_year:           number | null;
  mbti:                 string | null;
  basic_values:         string | null;
  animal_zodiac:        string | null;
};

type PartnerInsightRow = {
  partner_hint_encrypted: string | null;
  partner_hint_iv:        string | null;
  partner_hint_auth_tag:  string | null;
  created_at:             string;
};

function buildInstructions(
  partnerSummary: PartnerSummaryRow | null,
  partnerInsights: PartnerInsightRow[],
  consultationTitle: string | null
): string {
  let instructions = BASE_INSTRUCTIONS;

  if (consultationTitle) {
    instructions += `\n\n【この相談スレッドのテーマ】\n${consultationTitle}\n※ 会話の文脈が不明な場合も、このテーマに沿った返答をしてください。`;
  }

  // --- 固定プロフィール ---
  const profileLines: string[] = [];
  if (partnerSummary) {
    if (partnerSummary.gender)
      profileLines.push(`・性別: ${partnerSummary.gender}`);
    if (partnerSummary.birth_year)
      profileLines.push(`・生まれ年: ${partnerSummary.birth_year}年頃`);
    if (partnerSummary.mbti)
      profileLines.push(`・MBTI: ${partnerSummary.mbti}`);
    if (partnerSummary.animal_zodiac)
      profileLines.push(`・動物占い: ${partnerSummary.animal_zodiac}`);
    if (partnerSummary.basic_values)
      profileLines.push(`・基本価値観: ${partnerSummary.basic_values}`);
    if (partnerSummary.communication_style)
      profileLines.push(`・コミュニケーション傾向: ${partnerSummary.communication_style}`);
    if (partnerSummary.comfortable_phrases)
      profileLines.push(`・安心しやすい言葉: ${partnerSummary.comfortable_phrases}`);
    if (partnerSummary.avoid_phrases)
      profileLines.push(`・言われると傷つく言葉: ${partnerSummary.avoid_phrases}`);
    if (partnerSummary.notes)
      profileLines.push(`・その他メモ: ${partnerSummary.notes}`);
  }

  if (profileLines.length > 0) {
    instructions +=
      "\n\n【パートナーの固定プロフィール】\n" + profileLines.join("\n");
  }

  // --- 最近の時系列ヒント ---
  if (partnerInsights.length > 0) {
    const insightLines = partnerInsights.map((i) => `・${decryptHintBody(i)}`);
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

  // --- スレッドタイトルを取得 ---
  const { data: consultationRow } = await supabase
    .from("consultations")
    .select("title")
    .eq("id", consultationId)
    .maybeSingle();
  const consultationTitle = consultationRow?.title ?? null;

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
    { limit_count: 30 }
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
      model: "gpt-5.5",
      instructions: buildInstructions(partnerSummary, partnerInsights, consultationTitle),
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
    extractAndSaveInsight(supabase, latestUserMessage.body).catch((err) => {
      console.error("[api/chat] insight extraction failed (non-fatal):", err);
    });
    extractAndSaveMemo(supabase, latestUserMessage.body).catch((err) => {
      console.error("[api/chat] memo extraction failed (non-fatal):", err);
    });
  }

  return NextResponse.json({
    id: newMessageId as string,
    role: "assistant",
    body: aiText,
    created_at: new Date().toISOString(),
  });
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
