import "server-only";

import OpenAI from "openai";
import {
  HOME_WORLD_PROMPT_VERSION,
  type HomeWorldGenerationInput,
  type WorldBible,
} from "@/lib/couple-home-world/types";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "あなたはカップルアプリのホーム画面アートディレクターです。\n" +
  "直近の「ふたり質問」と回答だけを読み、ふたりだけの窓の向こうの景色を1枚で表現するための仕様を決めてください。\n\n" +
  "【目的】\n" +
  "ホームを開いた瞬間「この二人っぽい」と感じる、1枚の情景。\n" +
  "「何を獲得したか」ではなく、関係全体の空気と、会話から浮かぶ具体物が自然に共存する世界。\n\n" +
  "【優先順位】\n" +
  "1. 全体の色味・空気感・構図（最優先）\n" +
  "2. 具体物（小春、水族館、同棲など）は景色に溶け込む形で2〜4個\n" +
  "3. 1つは最初に目に入る存在（noticed_first）、もう1つはよく見るとわかる（noticed_second/subtle）\n\n" +
  "【禁止】\n" +
  "- コレクション・アイコン一覧・ステッカー配置のイメージ\n" +
  "- 画像内テキスト・ラベル・枠\n" +
  "- 相談・プロフィール情報の推測（入力にないことは足さない）\n\n" +
  "【scene_prompt】\n" +
  "英語2〜4文。arch window view, soft illustrated landscape/diorama, pastel, kawaii but scenic.\n" +
  "NOT photo, NOT 3D, NOT sticker sheet. no text in image.\n" +
  "具体物を naturally embedded in the scene と明記。";

function buildUserPrompt(input: HomeWorldGenerationInput): string {
  const blocks = input.rounds.map((round, index) => {
    const answerLines = round.answers
      .map((answer) => `${answer.name}: ${answer.answer}`)
      .join("\n");

    return (
      `--- 質問${index + 1} ---\n` +
      `Q: ${round.question}\n` +
      `${answerLines}`
    );
  });

  return (
    `開示済みふたり質問: ${input.revealedCount}件\n` +
    `以下 ${input.rounds.length} 件を参考に WorldBible を JSON で返してください。\n\n` +
    blocks.join("\n\n")
  );
}

function fallbackScenePrompt(bible: Partial<WorldBible>): string {
  const mood = bible.mood_summary ?? "a cozy couple's world";
  return (
    `Soft pastel illustrated landscape seen through an arch window, ${mood}, ` +
    `kawaii flat scenic art, warm gentle atmosphere, not a photo, no text, ` +
    `small charming details embedded naturally in the scene.`
  );
}

export async function generateWorldBibleWithAI(
  input: HomeWorldGenerationInput
): Promise<WorldBible | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateWorldBibleWithAI] OPENAI_API_KEY is missing");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "home_world_bible",
          strict: true,
          schema: {
            type: "object",
            properties: {
              mood_summary: { type: "string" },
              atmosphere: { type: "string" },
              palette: {
                type: "object",
                properties: {
                  primary: { type: "string" },
                  secondary: { type: "string" },
                  accent: { type: "string" },
                  sky: { type: "string" },
                  ground: { type: "string" },
                },
                required: ["primary", "secondary", "accent", "sky", "ground"],
                additionalProperties: false,
              },
              typography_mood: { type: "string" },
              composition: { type: "string" },
              embedded_memories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    how_it_appears: { type: "string" },
                    prominence: {
                      type: "string",
                      enum: ["noticed_first", "noticed_second", "subtle"],
                    },
                  },
                  required: ["subject", "how_it_appears", "prominence"],
                  additionalProperties: false,
                },
              },
              scene_prompt: { type: "string" },
              ui_tokens: {
                type: "object",
                properties: {
                  heart_color: { type: "string" },
                  subtitle_color: { type: "string" },
                },
                required: ["heart_color", "subtitle_color"],
                additionalProperties: false,
              },
            },
            required: [
              "mood_summary",
              "atmosphere",
              "palette",
              "typography_mood",
              "composition",
              "embedded_memories",
              "scene_prompt",
              "ui_tokens",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Omit<WorldBible, "prompt_version">;

    return {
      prompt_version: HOME_WORLD_PROMPT_VERSION,
      ...parsed,
      scene_prompt: parsed.scene_prompt?.trim() || fallbackScenePrompt(parsed),
    };
  } catch (err) {
    console.error("[generateWorldBibleWithAI] error:", err);
    return null;
  }
}
