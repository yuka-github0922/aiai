import "server-only";

import OpenAI from "openai";
import type { CoupleTraitsGenerationContext } from "@/lib/couple-traits-types";

const AVATAR_PROMPT_MODEL = "gpt-4.1-mini";
const AVATAR_IMAGE_MODELS = ["gpt-image-1", "dall-e-2"] as const;

const AVATAR_PROMPT_INSTRUCTIONS =
  "あなたはカップルアプリのイラスト担当です。紹介文をもとに、画像生成AI用の英語プロンプトを1つだけ出力してください。\n\n" +
  "【目的】\n" +
  "実在の人物の似顔絵ではなく、AiAiが「この人らしそう」と予想した、ふたりで笑い合えるキュートなイラスト。\n" +
  "恋愛アプリのプロフィールアイコン風。本人に似ている必要はない。\n\n" +
  "【ルール】\n" +
  "- 紹介文の雰囲気をやさしく反映（まじめそうならメガネ、犬が好きなら小さな犬のモチーフなど遊び心OK）\n" +
  "- cute soft illustration, pastel colors, bust portrait, simple background\n" +
  "- fictional stylized character, not photorealistic, not based on any real person\n" +
  "- warm and playful, dating app avatar style\n" +
  "- ネガティブ・暗い表現は禁止\n" +
  "- 英語のプロンプト1文のみ。説明・前置き不要";

type AvatarInput = {
  name: string;
  traits: string[];
  member: CoupleTraitsGenerationContext["members"][number];
};

function buildAvatarPromptInput(input: AvatarInput): string {
  const lines = [
    `名前: ${input.name}`,
    `性別: ${input.member.profile.gender ?? "未設定"}`,
    `紹介文:`,
    ...input.traits.map((trait) => `- ${trait}`),
    `基本価値観: ${input.member.profile.basicValues ?? "未設定"}`,
    `コミュニケーション傾向: ${input.member.profile.communicationStyle ?? "未設定"}`,
  ];

  if (input.member.insights.length > 0) {
    lines.push(
      "相談から感じたこと:",
      ...input.member.insights.slice(0, 5).map((insight) => `- ${insight}`)
    );
  }

  return lines.join("\n");
}

function fallbackImagePrompt(input: AvatarInput): string {
  const vibe = input.traits.join(" ").slice(0, 120);
  return (
    `A cute pastel illustration bust portrait of a fictional character named ${input.name}, ` +
    `dating app avatar style, warm playful mood, soft colors, simple background, not photorealistic. ` +
    `Personality hints: ${vibe}`
  );
}

async function buildImagePrompt(input: AvatarInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackImagePrompt(input);

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create({
      model: AVATAR_PROMPT_MODEL,
      instructions: AVATAR_PROMPT_INSTRUCTIONS,
      input: buildAvatarPromptInput(input),
    });

    const prompt = response.output_text?.trim();
    if (prompt && prompt.length > 0) return prompt;
  } catch (err) {
    console.error("[generateCoupleAvatarWithAI] prompt error:", err);
  }

  return fallbackImagePrompt(input);
}

function toDataUrl(b64: string, format: "png" | "webp" | "jpeg"): string {
  const mime =
    format === "webp" ? "image/webp" : format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${b64}`;
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
    size: "256x256",
    n: 1,
  });

  const image = response.data?.[0];
  if (image?.b64_json) {
    return toDataUrl(image.b64_json, "png");
  }

  if (image?.url) {
    return fetchImageUrlAsDataUrl(image.url);
  }

  return null;
}

export async function generateCoupleAvatarWithAI(
  input: AvatarInput
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generateCoupleAvatarWithAI] OPENAI_API_KEY is missing");
    return null;
  }

  const imagePrompt = await buildImagePrompt(input);
  const openai = new OpenAI({ apiKey });

  for (const model of AVATAR_IMAGE_MODELS) {
    try {
      const dataUrl =
        model === "gpt-image-1"
          ? await generateWithGptImage(openai, imagePrompt)
          : await generateWithDalle2(openai, imagePrompt);

      if (dataUrl) {
        console.log("[generateCoupleAvatarWithAI] success", {
          name: input.name,
          model,
          bytes: dataUrl.length,
        });
        return dataUrl;
      }

      console.warn("[generateCoupleAvatarWithAI] empty response", {
        name: input.name,
        model,
      });
    } catch (err) {
      console.error("[generateCoupleAvatarWithAI] image error", {
        name: input.name,
        model,
        err,
      });
    }
  }

  return null;
}

async function fetchImageUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(
        "[generateCoupleAvatarWithAI] image download failed:",
        res.status
      );
      return null;
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch (err) {
    console.error("[generateCoupleAvatarWithAI] image download error:", err);
    return null;
  }
}
