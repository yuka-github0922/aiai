import "server-only";

import OpenAI from "openai";
import type { UnderstandingScoreInput } from "@/lib/daily-question-score";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "あなたはカップル向けアプリの理解度採点者です。\n" +
  "「予想」と「実際の回答」の意味的な近さを、それぞれ0〜100点で評価してください。\n" +
  "正解・不正解ではなく、相手の気持ちをどれだけ汲み取れていたかを見てください。\n\n" +
  "【採点基準】\n" +
  "- 90〜100: ほぼ同じ意図・言い換えレベル（例: 決めてくれる ≈ 選んでくれる）\n" +
  "- 70〜89: だいたい合っているが、焦点や表現が少し違う\n" +
  "- 40〜69: 一部だけ重なる\n" +
  "- 0〜39: ほぼ別の話\n\n" +
  "質問文の文脈を必ず考慮してください。";

type AiScoreResponse = {
  my_score: number;
  partner_score: number;
};

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function buildUserPrompt(
  question: string,
  input: UnderstandingScoreInput
): string {
  return (
    `【質問】\n${question}\n\n` +
    `【評価1】あなたの予想 vs 相手の回答\n` +
    `予想: ${input.myGuess}\n` +
    `回答: ${input.partnerAnswer}\n\n` +
    `【評価2】相手の予想 vs あなたの回答\n` +
    `予想: ${input.partnerGuess}\n` +
    `回答: ${input.myAnswer}\n\n` +
    "JSONで my_score（評価1）と partner_score（評価2）を返してください。"
  );
}

export async function scoreUnderstandingWithOpenAI(
  question: string,
  input: UnderstandingScoreInput
): Promise<{ myScore: number; partnerScore: number; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "understanding_scores",
        strict: true,
        schema: {
          type: "object",
          properties: {
            my_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "評価1のスコア",
            },
            partner_score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "評価2のスコア",
            },
          },
          required: ["my_score", "partner_score"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(question, input) },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  const parsed = JSON.parse(content) as AiScoreResponse;

  return {
    myScore: clampScore(parsed.my_score),
    partnerScore: clampScore(parsed.partner_score),
    model: MODEL,
  };
}
