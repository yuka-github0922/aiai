import OpenAI from "openai";
import type {
  CoupleTraitsAiResult,
  CoupleTraitsGenerationContext,
} from "@/lib/couple-traits-types";

const TRAITS_MODEL = "gpt-4.1-mini";

const TRAITS_SYSTEM_PROMPT =
  "あなたはカップル向けAI「AiAi」です。\n\n" +
  "【このセクションの目的】\n" +
  "「ふたりがお互いを見て微笑むこと」です。\n" +
  "分析ではありません。性格診断でもありません。\n" +
  "AiAiが感じた「この人らしいな」を、恋愛アプリのプロフィール紹介に近い文体で書いてください。\n\n" +
  "【読者が感じてほしいこと】\n" +
  "- 本人が読んで「なんか嬉しい」\n" +
  "- 相手が読んで「たしかに」\n" +
  "- ふたりで見ながら、自然に笑顔になれる\n\n" +
  "【出力形式】\n" +
  "JSONのみ。形式:\n" +
  "{\n" +
  '  "self": { "name": "メンバー1の表示名", "traits": ["1行目", "2行目", "3行目"] },\n' +
  '  "partner": { "name": "メンバー2の表示名", "traits": ["1行目", "2行目", "3行目"] }\n' +
  "}\n" +
  "traits は紹介文の各行。self はメンバー1、partner はメンバー2。メンバーが1人だけの場合は partner を null。\n\n" +
  "【文体】\n" +
  "- 恋愛アプリのプロフィール紹介・登場人物紹介のような、やさしく親しみやすい文体\n" +
  "- 1行目：好きなこと・大切にしていること・この人らしい具体（会話や回答から観測できることがあれば）\n" +
  "- 2行目：魅力が伝わる、温かい特徴づけ\n" +
  "- 3行目：全体をやさしくまとめる一文（例：「感情豊かな女の子。」「大切な人のためには行動できる男の子。」）\n" +
  "- 各行は20〜40文字程度\n" +
  "- 各メンバー3行（最低3行、最大4行）\n\n" +
  "【絶対に禁止】\n" +
  "- 問題分析・改善提案・助言\n" +
  "- 心理分析（「〜しようとしている」「〜を抱えている」「〜したがっている」など内心の断定）\n" +
  "- 分析口調（「〜傾向がある」「〜が多い」「〜への関心が高い」などレポート調）\n" +
  "- 性格診断・MBTI・動物占いの説明（「INFPだから〜」など）\n" +
  "- 問題点の指摘、ネガティブな解釈、批判\n" +
  "- 相手が読んで嫌な気持ちになる表現\n" +
  "- 根拠のない推測\n" +
  "- 箇条書き記号（・）や番号\n\n" +
  "【情報の使い方】\n" +
  "- 相談から抽出された傾向（insights）とふたり質問の回答から、「らしさ」「好きなこと」「大切にしていること」を拾う\n" +
  "- プロフィールは補助情報。断定の根拠にしすぎない\n" +
  "- partner_impression は主観。事実として書かない\n\n" +
  "【理想例】\n" +
  "ゆか:\n" +
  "traits: [\n" +
  "  \"実家の柴犬・小春が大好き。\",\n" +
  "  \"嬉しいことも不安なことも素直に感じる、\",\n" +
  "  \"感情豊かな女の子。\"\n" +
  "]\n" +
  "あお:\n" +
  "traits: [\n" +
  "  \"将来のことを考えるのが好き。\",\n" +
  "  \"少し慎重だけど、\",\n" +
  "  \"大切な人のためには行動できる男の子。\"\n" +
  "]\n\n" +
  "前置き・説明・Markdownは不要";

function formatProfileBlock(
  member: CoupleTraitsGenerationContext["members"][number]
): string {
  const lines = [
    `名前: ${member.name}`,
    `性別: ${member.profile.gender ?? "未設定"}`,
    `基本価値観: ${member.profile.basicValues ?? "未設定"}`,
    `コミュニケーション傾向: ${member.profile.communicationStyle ?? "未設定"}`,
  ];

  if (member.profile.partnerImpressionAboutOther) {
    lines.push(
      `パートナーについての主観的印象: ${member.profile.partnerImpressionAboutOther}`
    );
  }

  if (member.insights.length > 0) {
    lines.push(
      "相談から抽出された傾向:",
      ...member.insights.slice(0, 15).map((insight) => `・${insight}`)
    );
  } else {
    lines.push("相談から抽出された傾向: なし");
  }

  return lines.join("\n");
}

function formatDailyQuestionsBlock(
  context: CoupleTraitsGenerationContext
): string {
  if (context.dailyQuestions.length === 0) {
    return "ふたり質問履歴: なし";
  }

  return context.dailyQuestions
    .map((round, index) => {
      const answerLines = round.answers
        .map((answer) => `  ${answer.name}の回答: ${answer.answer} / 予想: ${answer.guess}`)
        .join("\n");
      const score =
        round.understandingCoupleScore !== null
          ? `理解度（ふたり）: ${round.understandingCoupleScore}`
          : "理解度（ふたり）: 未設定";

      return [
        `--- ${index + 1} ---`,
        `質問: ${round.question}`,
        answerLines,
        score,
      ].join("\n");
    })
    .join("\n\n");
}

function buildTraitsInput(context: CoupleTraitsGenerationContext): string {
  const memberBlocks = context.members.map((member, index) => {
    const label =
      index === 0
        ? "【メンバー1（カップル内の先に参加した人）】"
        : "【メンバー2】";
    return `${label}\n${formatProfileBlock(member)}`;
  });

  return (
    memberBlocks.join("\n\n") +
    "\n\n【ふたり質問履歴（直近）】\n" +
    formatDailyQuestionsBlock(context) +
    "\n\n上記をもとに、ふたりが見て微笑める「AiAiからの紹介文」を JSON で出力してください。"
  );
}

function normalizeTraits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function parseTraitsResponse(text: string): CoupleTraitsAiResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      self?: { name?: string; traits?: unknown };
      partner?: { name?: string; traits?: unknown } | null;
    };

    const selfTraits = normalizeTraits(parsed.self?.traits);
    const partnerTraits =
      parsed.partner === null || parsed.partner === undefined
        ? null
        : normalizeTraits(parsed.partner?.traits);

    if (!parsed.self?.name || selfTraits.length < 3) {
      return null;
    }

    if (
      parsed.partner &&
      parsed.partner !== null &&
      (!parsed.partner.name || (partnerTraits?.length ?? 0) < 3)
    ) {
      return null;
    }

    return {
      self: {
        name: parsed.self.name.trim(),
        traits: selfTraits,
      },
      partner:
        parsed.partner && partnerTraits && partnerTraits.length >= 3
          ? {
              name: parsed.partner.name!.trim(),
              traits: partnerTraits,
            }
          : null,
    };
  } catch {
    return null;
  }
}

export type GenerateCoupleTraitsResult = {
  result: CoupleTraitsAiResult;
  model: string;
};

export async function generateCoupleTraitsWithAI(
  context: CoupleTraitsGenerationContext
): Promise<GenerateCoupleTraitsResult | null> {
  if (context.members.length === 0) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateCoupleTraitsWithAI] OPENAI_API_KEY is missing");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create({
      model: TRAITS_MODEL,
      instructions: TRAITS_SYSTEM_PROMPT,
      input: buildTraitsInput(context),
    });

    const parsed = parseTraitsResponse(response.output_text ?? "");
    if (!parsed) {
      console.error("[generateCoupleTraitsWithAI] invalid AI response");
      return null;
    }

    return { result: parsed, model: TRAITS_MODEL };
  } catch (err) {
    console.error("[generateCoupleTraitsWithAI] OpenAI error:", err);
    return null;
  }
}
