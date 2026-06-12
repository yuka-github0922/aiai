import "server-only";

import OpenAI from "openai";
import {
  HOME_WORLD_GROWTH_PROMPT_VERSION,
  type HomeWorldRegrowthInput,
  type WorldBible,
  type WorldBibleGrowthResult,
} from "@/lib/couple-home-world/types";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "あなたはカップルアプリのホーム画面アートディレクターです。\n" +
  "Phase 2: 前回の WorldBible をベースに、ふたりの世界を「少しだけ」育ててください。\n\n" +
  "【目的】\n" +
  "毎回まったく新しい画像にするのではなく、前回の世界観・色味・構図・既存モチーフを維持し、\n" +
  "新しいふたり質問の内容を少しだけ反映する。\n\n" +
  "【維持するもの（大きく変えない）】\n" +
  "- palette（色味）\n" +
  "- composition（構図）\n" +
  "- atmosphere / mood_summary の核\n" +
  "- embedded_memories に既にある subject（削除・大幅変更しない）\n\n" +
  "【変更してよいもの】\n" +
  "- 既存 subject の prominence を1段階上げる（subtle → noticed_second 等）\n" +
  "- 新しい subject を最大1〜2個追加\n" +
  "- scene_prompt に小さな追加描写\n\n" +
  "【visual_change_needed】\n" +
  "新しい質問が抽象的（感謝・気持ちのみ）で視覚化が不自然な場合は false。\n" +
  "視覚的に意味のある変化がある場合のみ true。\n\n" +
  "【禁止】\n" +
  "- コレクション・アイコン一覧・ステッカー配置\n" +
  "- 画像内テキスト・ラベル\n" +
  "- 入力にない情報の推測\n" +
  "- 世界の全面リデザイン";

function buildUserPrompt(input: HomeWorldRegrowthInput): string {
  const newBlocks = input.newRounds.map((round, index) => {
    const answerLines = round.answers
      .map((answer) => `${answer.name}: ${answer.answer}`)
      .join("\n");

    return (
      `--- 新規質問${index + 1} ---\n` +
      `Q: ${round.question}\n` +
      `${answerLines}`
    );
  });

  return (
    `開示済みふたり質問: ${input.revealedCount}件\n` +
    `前回反映済み round 数: ${input.previousSourceRoundIds.length}\n\n` +
    `【前回の WorldBible】\n` +
    `${JSON.stringify(input.previousWorldBible, null, 2)}\n\n` +
    `【前回の scene_prompt】\n` +
    `${input.previousWorldBible.scene_prompt}\n\n` +
    `【新しく増えたふたり質問】\n` +
    `${newBlocks.join("\n\n")}\n\n` +
    "上記をもとに、更新版 WorldBible と visual_change_needed / change_summary を JSON で返してください。"
  );
}

function fallbackScenePrompt(bible: Partial<WorldBible>): string {
  const mood = bible.mood_summary ?? "a cozy couple's world";
  return (
    `Same world, same composition, preserve the previous atmosphere and color palette. ` +
    `Only subtle additions, do not redesign the scene. ` +
    `Soft pastel illustrated landscape seen through an arch window, ${mood}, ` +
    `kawaii flat scenic art, warm gentle atmosphere, not a photo, no text.`
  );
}

export async function generateWorldBibleGrowthWithAI(
  input: HomeWorldRegrowthInput
): Promise<WorldBibleGrowthResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateWorldBibleGrowthWithAI] OPENAI_API_KEY is missing");
    return null;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.35,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "home_world_bible_growth",
          strict: true,
          schema: {
            type: "object",
            properties: {
              visual_change_needed: { type: "boolean" },
              change_summary: { type: "string" },
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
              "visual_change_needed",
              "change_summary",
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

    const parsed = JSON.parse(raw) as {
      visual_change_needed: boolean;
      change_summary: string;
      mood_summary: string;
      atmosphere: string;
      palette: WorldBible["palette"];
      typography_mood: string;
      composition: string;
      embedded_memories: WorldBible["embedded_memories"];
      scene_prompt: string;
      ui_tokens: WorldBible["ui_tokens"];
    };

    const worldBible: WorldBible = {
      prompt_version: HOME_WORLD_GROWTH_PROMPT_VERSION,
      mood_summary: parsed.mood_summary,
      atmosphere: parsed.atmosphere,
      palette: parsed.palette,
      typography_mood: parsed.typography_mood,
      composition: parsed.composition,
      embedded_memories: parsed.embedded_memories,
      scene_prompt: parsed.scene_prompt?.trim() || fallbackScenePrompt(parsed),
      ui_tokens: parsed.ui_tokens,
    };

    return {
      worldBible,
      visualChangeNeeded: parsed.visual_change_needed,
      changeSummary: parsed.change_summary,
    };
  } catch (err) {
    console.error("[generateWorldBibleGrowthWithAI] error:", err);
    return null;
  }
}
