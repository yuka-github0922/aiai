import OpenAI from "openai";
import type { MemoRow } from "@/lib/nudge";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INTERPRET_INSTRUCTIONS =
  "以下のメモは、ユーザー発言から抽出した具体情報です。\n" +
  "ダッシュボードに表示するため、それぞれを「AiAiが理解したこと」として1文に言い換えてください。\n\n" +
  "【ルール】\n" +
  "- ユーザーの発言そのまま・商品名・場所名・条件は書かない\n" +
  "- 事実ではなく、関係性や気持ちの意味として表現する\n" +
  "- ペット名は関係性を表す場合のみ残してよい\n" +
  "- 1文、20〜30文字程度\n" +
  "- 例: 「小春と3人で住める物件が欲しい」→「小春は家族として大切にしている」\n" +
  "- 例: 「わんわん遊園地に行きたい」→「小春との時間を大切にしたい」\n\n" +
  "【出力形式】\n" +
  "JSON配列のみ。各要素: {\"id\":\"...\",\"understanding\":\"...\"}\n" +
  "前置き・説明は不要";

type MemoInput = Pick<MemoRow, "content" | "created_at"> & { id?: string };

function memoKey(memo: MemoInput): string {
  return memo.id ?? memo.created_at;
}

/** 具体メモを「AiAiが理解したこと」に言い換える（表示用） */
export async function interpretMemosForDisplay(
  memos: MemoInput[]
): Promise<Map<string, string>> {
  const pool = memos
    .filter((m) => m.content.trim() && m.content.trim() !== "なし")
    .slice(0, 5);

  if (pool.length === 0) return new Map();

  if (!process.env.OPENAI_API_KEY) {
    return heuristicInterpretMap(pool);
  }

  try {
    const input = JSON.stringify(
      pool.map((m) => ({ id: memoKey(m), content: m.content }))
    );

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: INTERPRET_INSTRUCTIONS,
      input,
    });

    const parsed = parseInterpretResponse(response.output_text ?? "", pool);
    if (parsed.size > 0) return parsed;
  } catch (err) {
    console.error("[interpretMemosForDisplay] OpenAI error:", err);
  }

  return heuristicInterpretMap(pool);
}

function parseInterpretResponse(
  text: string,
  pool: MemoInput[]
): Map<string, string> {
  const map = new Map<string, string>();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return map;

    const items = JSON.parse(jsonMatch[0]) as {
      id?: string;
      understanding?: string;
    }[];

    for (const item of items) {
      if (!item.id || !item.understanding?.trim()) continue;
      map.set(item.id, item.understanding.trim());
    }
  } catch {
    return map;
  }

  // パース漏れがあればヒューリスティックで補完
  for (const memo of pool) {
    const key = memoKey(memo);
    if (!map.has(key)) {
      const fallback = heuristicMemoUnderstanding(memo.content);
      if (fallback) map.set(key, fallback);
    }
  }

  return map;
}

function heuristicInterpretMap(pool: MemoInput[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const memo of pool) {
    const understanding = heuristicMemoUnderstanding(memo.content);
    if (understanding) map.set(memoKey(memo), understanding);
  }
  return map;
}

/** OpenAI 不可時のフォールバック */
export function heuristicMemoUnderstanding(content: string): string | null {
  const text = content.trim();
  if (!text || text === "なし") return null;

  const hasPet = /小春|犬|猫|ペット|わんわん/.test(text);

  if (hasPet && /物件|住める|同棲|マンション|部屋|引っ越/.test(text)) {
    return "小春は家族として大切にしている";
  }
  if (hasPet && /遊園地|行きたい|デート|遊び|公園/.test(text)) {
    return "小春との時間を大切にしたい";
  }
  if (/同棲|住める|物件|引っ越|暮らし/.test(text)) {
    return "同棲について話し合っている";
  }
  if (/行きたい|遊園地|旅行|デート/.test(text)) {
    return "一緒の時間を大切にしたい";
  }
  if (/欲しい|プレゼント|財布|ギフト/.test(text)) {
    return "相手の気持ちを大切にしたい";
  }
  if (/好き|大切|家族/.test(text)) {
    return text.length <= 30 ? text : `${text.slice(0, 29)}…`;
  }

  return text.length <= 30 ? text : `${text.slice(0, 29)}…`;
}
