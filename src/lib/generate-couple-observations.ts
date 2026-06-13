import OpenAI from "openai";
import type { AiRecentNotice } from "@/lib/couple-portrait";
import type { CoupleTraitsGenerationContext } from "@/lib/couple-traits-types";

const OBSERVATIONS_MODEL = "gpt-4.1-mini";

const UNSAFE_LABEL_PATTERNS = [
  /冷たい|無視|嫌|怒|ケンカ|喧嘩|別れ|破局|やめる|離れ|うんざり|耐えられ|限界/,
  /不安|心配|モヤモヤ|イライラ|落ち込|ショック|傷つ|悲し|辛|苦し|ネガティブ/,
  /言われた|された|されて|彼が|彼女が|相手が.*(?:冷|嫌|怒)/,
];

const OBSERVATIONS_SYSTEM_PROMPT =
  "あなたはカップル向けAI「AiAi」です。\n\n" +
  "【このセクションの目的】\n" +
  "ふたりタブ「AiAiが最近気づいたこと」向けの観察レポートです。\n" +
  "ふたりの相談・雑談・メモ・デイリー質問から、「最近の変化」「関係性の進展」「話題の変化」だけを読み取り、" +
  "やさしく中立的な観察文として言語化してください。\n\n" +
  "【入力の扱い】\n" +
  "- 相談から抽出された傾向（insights）やメモは、ふたりの会話の材料として使ってよい\n" +
  "- ただし出力にベタ書き・言い換えすぎて判別できる引用は禁止\n" +
  "- 一時的な不安・愚痴・ネガティブ感情・解決済みの悩みは出力に反映しない\n" +
  "- どちらかを批判・問題視する表現は禁止\n" +
  "- 「相手がこう言っていた」系は禁止\n\n" +
  "【出力してはいけない例（入力に含まれていても捨てる）】\n" +
  "- 「彼が冷たい気がする」\n" +
  "- 「同棲をやめるかもしれないと言われた」\n" +
  "- 別れ・破局・限界・我慢できない系\n\n" +
  "【出力してよい例（このトーン）】\n" +
  "- 「最近は気持ちを確認したい話題が増えている」\n" +
  "- 「住まいについて具体的な話が増えている」\n" +
  "- 「ペットとの生活を想像する会話が増えてきた」\n\n" +
  "【出力形式】\n" +
  "JSONのみ:\n" +
  '{ "notices": [ { "emoji": "💬", "label": "観察文" } ] }\n' +
  "- 0〜3件（材料が乏しい場合は空配列）\n" +
  "- label は20〜35文字・観察レポート調\n" +
  "- emoji は1文字（💬 🏠 🐶 🎢 🎁 ✨ 💭 など）\n" +
  "- 人物像の紹介文（それは別セクション）ではない\n\n" +
  "前置き・説明・Markdownは不要";

function formatMemberSignalsBlock(
  member: CoupleTraitsGenerationContext["members"][number],
  index: number
): string {
  const label = index === 0 ? "メンバー1" : "メンバー2";
  const insightLines =
    member.insights.length > 0
      ? member.insights.slice(0, 15).map((insight) => `・${insight}`)
      : ["・なし"];
  const memoLines =
    member.memos.length > 0
      ? member.memos.slice(0, 10).map((memo) => `・${memo}`)
      : ["・なし"];

  return [
    `【${label}: ${member.name}】`,
    "相談から抽出された傾向（内部材料・出力にそのまま書かない）:",
    ...insightLines,
    "メモ（内部材料・出力にそのまま書かない）:",
    ...memoLines,
  ].join("\n");
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
        .map((answer) => `  ${answer.name}: 回答=${answer.answer} / 予想=${answer.guess}`)
        .join("\n");

      return [
        `--- ${index + 1} ---`,
        `質問: ${round.question}`,
        answerLines,
      ].join("\n");
    })
    .join("\n\n");
}

function buildObservationsInput(context: CoupleTraitsGenerationContext): string {
  const memberBlocks = context.members.map((member, index) =>
    formatMemberSignalsBlock(member, index)
  );

  const hasSignals = context.members.some(
    (member) => member.insights.length > 0 || member.memos.length > 0
  );
  const hasDailyQuestions = context.dailyQuestions.length > 0;

  if (!hasSignals && !hasDailyQuestions) {
    return "材料なし。notices は空配列 [] で返してください。";
  }

  return (
    memberBlocks.join("\n\n") +
    "\n\n【ふたり質問履歴（直近）】\n" +
    formatDailyQuestionsBlock(context) +
    "\n\n上記から、最近の変化・関係性の進展・話題の変化だけを観察レポートとして JSON で出力してください。"
  );
}

function emojiForObservation(label: string): string {
  if (/犬|猫|ペット|家族/.test(label)) return "🐶";
  if (/住|暮らし|同棲|家/.test(label)) return "🏠";
  if (/話|会話|コミュニケーション|気持ち|確認/.test(label)) return "💬";
  if (/時間|デート|遊び|一緒/.test(label)) return "🎢";
  if (/記念日|将来|進展|前向き/.test(label)) return "✨";
  return "💭";
}

function isSafeObservationLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 12 || trimmed.length > 40) return false;
  return !UNSAFE_LABEL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function parseObservationsResponse(text: string): AiRecentNotice[] {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      notices?: { emoji?: string; label?: string }[];
    };

    if (!Array.isArray(parsed.notices)) return [];

    return parsed.notices
      .map((notice) => {
        const label = notice.label?.trim() ?? "";
        if (!isSafeObservationLabel(label)) return null;

        const emoji =
          typeof notice.emoji === "string" && notice.emoji.trim().length > 0
            ? notice.emoji.trim()
            : emojiForObservation(label);

        return { emoji, label };
      })
      .filter((notice): notice is AiRecentNotice => notice !== null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export type GenerateCoupleObservationsResult = {
  notices: AiRecentNotice[];
  model: string;
};

export async function generateCoupleObservationsWithAI(
  context: CoupleTraitsGenerationContext
): Promise<GenerateCoupleObservationsResult | null> {
  if (context.members.length === 0) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateCoupleObservationsWithAI] OPENAI_API_KEY is missing");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create({
      model: OBSERVATIONS_MODEL,
      instructions: OBSERVATIONS_SYSTEM_PROMPT,
      input: buildObservationsInput(context),
    });

    const notices = parseObservationsResponse(response.output_text ?? "");

    return { notices, model: OBSERVATIONS_MODEL };
  } catch (err) {
    console.error("[generateCoupleObservationsWithAI] OpenAI error:", err);
    return null;
  }
}

export function hasObservationSourceData(
  context: CoupleTraitsGenerationContext
): boolean {
  const hasMemberSignals = context.members.some(
    (member) => member.insights.length > 0 || member.memos.length > 0
  );
  return hasMemberSignals || context.dailyQuestions.length > 0;
}
