import "server-only";

import OpenAI from "openai";
import {
  PALETTE_HINT_SCHEMA,
  SCENE_SCHEMA,
  WORLD_IDENTITY_SCHEMA,
} from "@/lib/couple-home-world/generate-world-bible-ai";
import { getScenePrompt } from "@/lib/couple-home-world/parse-world-bible";
import type {
  AiWorldBibleOutput,
  HomeWorldRegrowthInput,
  WorldBibleGrowthResult,
} from "@/lib/couple-home-world/types";

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "あなたはカップルアプリのホーム画面アートディレクターです。\n" +
  "前回の world_identity をベースに、ふたりの世界を「少しだけ」育ててください。\n\n" +
  "【維持するもの】\n" +
  "- world_identity.phrase の核（30%以上書き換えない、追記・微调）\n" +
  "- scene の構図・空気感\n" +
  "- embedded_memories の既存 subject（削除しない）\n\n" +
  "【変更してよいもの】\n" +
  "- sensory / anchors の追加\n" +
  "- 新 subject を最大1〜2個\n" +
  "- scene_prompt の小さな追加\n\n" +
  "【フラグ】\n" +
  "- visual_change_needed: hero 画像に視覚変化が必要か\n" +
  "- ui_change_needed: ホーム UI の色・空気に変化が必要か\n" +
  "- preset_shift_needed: 背景骨格の変更が必要か（稀）\n" +
  "- identity_evolved: world_identity に意味ある更新があったか\n" +
  "抽象的な感謝のみ → visual/ui/preset は false 可\n\n" +
  "【禁止】\n" +
  "- hex / CSS / preset 名\n" +
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

  const previousPhrase =
    input.previousWorldBible.worldIdentity?.phrase ??
    input.previousWorldBible.scene.mood_summary;

  return (
    `開示済みふたり質問: ${input.revealedCount}件\n` +
    `前回反映済み round 数: ${input.previousSourceRoundIds.length}\n\n` +
    `【前回の world_identity phrase】\n${previousPhrase}\n\n` +
    `【前回の WorldBible】\n` +
    `${JSON.stringify(input.previousWorldBible.stored, null, 2)}\n\n` +
    `【前回の scene_prompt】\n` +
    `${getScenePrompt(input.previousWorldBible)}\n\n` +
    `【新しく増えたふたり質問】\n` +
    `${newBlocks.join("\n\n")}\n\n` +
    "更新版 JSON を返してください。"
  );
}

function fallbackScenePrompt(partial: { mood_summary?: string }): string {
  const mood = partial.mood_summary ?? "a cozy couple's world";
  return (
    `Same world, same composition, preserve the previous atmosphere. ` +
    `Only subtle additions. Soft pastel illustrated landscape through an arch window, ${mood}, ` +
    `kawaii scenic art, not a photo, no text.`
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
          name: "home_world_v3_growth",
          strict: true,
          schema: {
            type: "object",
            properties: {
              identity_evolved: { type: "boolean" },
              visual_change_needed: { type: "boolean" },
              ui_change_needed: { type: "boolean" },
              preset_shift_needed: { type: "boolean" },
              change_summary: { type: "string" },
              world_identity: WORLD_IDENTITY_SCHEMA,
              palette_hint: PALETTE_HINT_SCHEMA,
              scene: SCENE_SCHEMA,
            },
            required: [
              "identity_evolved",
              "visual_change_needed",
              "ui_change_needed",
              "preset_shift_needed",
              "change_summary",
              "world_identity",
              "palette_hint",
              "scene",
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

    const parsed = JSON.parse(raw) as AiWorldBibleOutput & {
      identity_evolved: boolean;
      visual_change_needed: boolean;
      ui_change_needed: boolean;
      preset_shift_needed: boolean;
      change_summary: string;
    };

    const output: AiWorldBibleOutput = {
      world_identity: parsed.world_identity,
      palette_hint: parsed.palette_hint,
      scene: {
        ...parsed.scene,
        scene_prompt:
          parsed.scene.scene_prompt?.trim() ||
          fallbackScenePrompt(parsed.scene),
      },
    };

    return {
      output,
      flags: {
        identity_evolved: parsed.identity_evolved,
        visual_change_needed: parsed.visual_change_needed,
        ui_change_needed: parsed.ui_change_needed,
        preset_shift_needed: parsed.preset_shift_needed,
        change_summary: parsed.change_summary,
      },
    };
  } catch (err) {
    console.error("[generateWorldBibleGrowthWithAI] error:", err);
    return null;
  }
}
