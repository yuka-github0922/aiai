import "server-only";

import OpenAI from "openai";
import type { AiWorldBibleOutput, HomeWorldGenerationInput } from "@/lib/couple-home-world/types";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "あなたはカップルアプリのホーム画面アートディレクターです。\n" +
  "直近の「ふたり質問」と回答だけを読み、このカップルだけの世界らしさを言語化してください。\n\n" +
  "【目的】\n" +
  "ホームを開いた瞬間「うちらの画面」と感じる、ふたり固有の世界観。\n" +
  "テーマカテゴリではなく、この二人だけの phrase を書いてください。\n\n" +
  "【出力するもの】\n" +
  "- world_identity: phrase / mood / sensory / anchors\n" +
  "- palette_hint: 温度・明度・彩度のヒントのみ\n" +
  "- scene: hero 画像用の情景描写\n\n" +
  "【禁止】\n" +
  "- hex カラーコード、CSS、preset 名、UI コンポーネント指定\n" +
  "- コレクション・ステッカー配置のイメージ\n" +
  "- 画像内テキスト\n" +
  "- 入力にない情報の推測\n\n" +
  "【scene.scene_prompt】\n" +
  "英語2〜4文。arch window view, soft illustrated landscape, pastel, kawaii scenic.\n" +
  "NOT photo, NOT 3D. no text in image.";

const WORLD_IDENTITY_SCHEMA = {
  type: "object",
  properties: {
    phrase: { type: "string" },
    mood: { type: "string" },
    sensory: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
    },
    anchors: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
    },
  },
  required: ["phrase", "mood", "sensory", "anchors"],
  additionalProperties: false,
} as const;

const PALETTE_HINT_SCHEMA = {
  type: "object",
  properties: {
    temperature: { type: "string", enum: ["warm", "cool", "neutral"] },
    brightness: { type: "string", enum: ["light", "medium", "dark"] },
    saturation: { type: "string", enum: ["soft", "vivid"] },
  },
  required: ["temperature", "brightness", "saturation"],
  additionalProperties: false,
} as const;

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    mood_summary: { type: "string" },
    atmosphere: { type: "string" },
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
  },
  required: [
    "mood_summary",
    "atmosphere",
    "composition",
    "embedded_memories",
    "scene_prompt",
  ],
  additionalProperties: false,
} as const;

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
    `以下 ${input.rounds.length} 件から world_identity と scene を JSON で返してください。\n\n` +
    blocks.join("\n\n")
  );
}

function fallbackScenePrompt(partial: { mood_summary?: string }): string {
  const mood = partial.mood_summary ?? "a cozy couple's world";
  return (
    `Soft pastel illustrated landscape seen through an arch window, ${mood}, ` +
    `kawaii flat scenic art, warm gentle atmosphere, not a photo, no text, ` +
    `small charming details embedded naturally in the scene.`
  );
}

export async function generateWorldBibleWithAI(
  input: HomeWorldGenerationInput
): Promise<AiWorldBibleOutput | null> {
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
          name: "home_world_v3_identity",
          strict: true,
          schema: {
            type: "object",
            properties: {
              world_identity: WORLD_IDENTITY_SCHEMA,
              palette_hint: PALETTE_HINT_SCHEMA,
              scene: SCENE_SCHEMA,
            },
            required: ["world_identity", "palette_hint", "scene"],
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

    const parsed = JSON.parse(raw) as AiWorldBibleOutput;

    return {
      ...parsed,
      scene: {
        ...parsed.scene,
        scene_prompt:
          parsed.scene.scene_prompt?.trim() ||
          fallbackScenePrompt(parsed.scene),
      },
    };
  } catch (err) {
    console.error("[generateWorldBibleWithAI] error:", err);
    return null;
  }
}

export { WORLD_IDENTITY_SCHEMA, PALETTE_HINT_SCHEMA, SCENE_SCHEMA };
