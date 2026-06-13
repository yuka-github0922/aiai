import "server-only";

import OpenAI from "openai";
import type { WorldIdentity, WorldScene } from "@/lib/couple-home-world/types";

const PROMPT_MODEL = "gpt-4.1-mini";
const IMAGE_MODELS = ["gpt-image-1", "dall-e-2"] as const;

export type HeroSceneInput = {
  scene: WorldScene;
  worldIdentity?: WorldIdentity | null;
};

function toDataUrl(b64: string, format: "png" | "webp" | "jpeg"): string {
  const mime =
    format === "webp" ? "image/webp" : format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${b64}`;
}

const CONTINUITY_PREFIX =
  "Same world, same composition, preserve the previous atmosphere and color palette. " +
  "Only subtle additions, do not redesign the scene. ";

async function refineScenePrompt(
  input: HeroSceneInput,
  options?: { continuity?: boolean }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const draft = input.scene.scene_prompt;
  if (!apiKey) {
    return options?.continuity ? `${CONTINUITY_PREFIX}${draft}` : draft;
  }

  const openai = new OpenAI({ apiKey });

  const continuityNote = options?.continuity
    ? "This is a gentle evolution of an EXISTING scene — preserve layout, palette, and mood. "
    : "";

  const identityLine = input.worldIdentity
    ? `World identity: ${input.worldIdentity.phrase}\nSensory: ${input.worldIdentity.sensory.join(", ")}\n`
    : "";

  try {
    const response = await openai.responses.create({
      model: PROMPT_MODEL,
      instructions:
        continuityNote +
        "Write ONE English paragraph for an AI image generator. " +
        "Soft pastel illustrated scenic view through an arch window, kawaii diorama landscape, " +
        "NOT photo, NOT sticker sheet, NOT 3D. No text in image. " +
        "Embed the couple's specific elements naturally in the scene.",
      input:
        identityLine +
        `Mood: ${input.scene.mood_summary}\nDraft: ${draft}`,
    });

    const refined = response.output_text?.trim();
    if (refined && refined.length > 0) {
      if (options?.continuity && !refined.toLowerCase().includes("same world")) {
        return `${CONTINUITY_PREFIX}${refined}`;
      }
      return refined;
    }
  } catch (err) {
    console.error("[generateHeroSceneImage] prompt refine error:", err);
  }

  return options?.continuity ? `${CONTINUITY_PREFIX}${draft}` : draft;
}

async function generateWithGptImage(
  openai: OpenAI,
  prompt: string
): Promise<string | null> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 70,
    moderation: "low",
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) return null;

  return toDataUrl(b64, "webp");
}

async function generateWithDalle2(
  openai: OpenAI,
  prompt: string
): Promise<string | null> {
  const response = await openai.images.generate({
    model: "dall-e-2",
    prompt,
    size: "512x512",
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) return null;

  return toDataUrl(b64, "png");
}

export async function generateHeroSceneImage(
  input: HeroSceneInput,
  options?: { continuity?: boolean }
): Promise<{ dataUrl: string | null; model: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateHeroSceneImage] OPENAI_API_KEY is missing");
    return { dataUrl: null, model: null };
  }

  const prompt = await refineScenePrompt(input, options);
  const openai = new OpenAI({ apiKey });

  for (const model of IMAGE_MODELS) {
    try {
      const dataUrl =
        model === "gpt-image-1"
          ? await generateWithGptImage(openai, prompt)
          : await generateWithDalle2(openai, prompt);

      if (dataUrl) {
        console.log("[generateHeroSceneImage] success", { model });
        return { dataUrl, model };
      }

      console.warn("[generateHeroSceneImage] empty response", { model });
    } catch (err) {
      console.error("[generateHeroSceneImage] image error", { model, err });
    }
  }

  return { dataUrl: null, model: null };
}
