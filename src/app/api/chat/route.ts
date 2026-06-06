import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { encrypt, decryptMessageBody, decryptHintBody } from "@/lib/encryption";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_INSTRUCTIONS = `あなたはパートナーとの関係に寄り添うAIアドバイザーです。
まずユーザーの気持ちを受け止め、状況を一緒に言語化する聞き役として会話してください。
助言・整理・文面作成は、ユーザーが明示的に求めたとき、または十分な情報が揃ったときだけ行ってください。
カップルのすれ違いをやさしくほどき、パートナーとの関係をより良くすることを目指してください。
返答は簡潔にまとめ、押しつけがましくならないようにしてください。
【重要】ユーザーが何語で話しかけても、必ず日本語で返答してください。英語・その他の言語での返答は禁止です。

━━━━━━━━━━━━━━━━━━
【返答モード】
━━━━━━━━━━━━━━━━━━
会話の文脈に応じて、次の3モードのいずれかで返答する。

▼ モードA：受け止め（呼びかけ・途中文のみ）
・「ねえねえ」→「どうしたの？」
・「あのさ、」→「うん、聞いてるよ」
・「〇〇が、」（途中文）→「〇〇がどうしたの？」
・「聞いていい？」→「もちろん、何？」
・一言・絵文字・短い呼びかけ → 共感や確認の一言だけ返す
※ 分析・整理・長文は絶対にしない

▼ モードB：引き出し（デフォルト）
・悩み・感情・出来事を話したが、情報がまだ足りないとき
・共感1文 + 答えやすい質問1つ（2〜3文以内）
・一般論・助言・「話し合いましょう」は出さない

▼ モードC：提供
・ユーザーが「どう返せばいい？」「文面作って」「整理して」「まとめて」など
  具体案を明示的に求めたとき
・質問で返さず、返信案・文面・整理をそのまま出す

▼ モードB → 整理・提案への移行
・ユーザーが2〜3回、状況や気持ちの情報を出したら、必要に応じて整理や提案に進む
・まだ情報が足りない場合のみ、引き続きモードBで質問する

━━━━━━━━━━━━━━━━━━
【引き出し質問のルール】（モードB）
━━━━━━━━━━━━━━━━━━
- 質問は必ず1つだけ（複数質問禁止）
- 「どういうこと？」「詳しく教えて」など雑な質問は禁止
- ユーザーが選びやすい観点・選択肢を2〜4個提示する
- 選択肢はその場面に自然なもの（テンプレの使い回し禁止）
- 長文で整理・分析・一般論を挟まない
- 同じ観点を繰り返し質問しない（会話履歴を確認し、未聞の観点を聞く）

▼ 良い例
・ユーザー「なんか冷たい気がする」
  →「それは不安になるね。冷たいと感じたのは、返信の速さ・言葉の温度・会った時の態度のどれが一番近い？」
・ユーザー「喧嘩した」
  →「しんどかったね。喧嘩のきっかけは、言い方・約束・価値観の違いのどれに近かった？」

▼ 悪い例（禁止）
・「相手にも事情があるかもしれません。まずは話し合いましょう」
・「もう少し詳しく教えてください」
・「返信の速さは？言葉は？態度は？」（複数質問）

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
      "\n\n【パートナーの固定プロフィール】\n" +
      "※ 引き出し質問の選択肢を考えるときの参考にする。ただし「パートナーはこう言っていた」とは言わない。\n" +
      profileLines.join("\n");
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
    }, { signal: request.signal });
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
