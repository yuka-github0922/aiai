import OpenAI from "openai";
import type { MemoRow } from "@/lib/nudge";
import { heuristicMemoUnderstanding } from "@/lib/memo-understanding";

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

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/** 具体メモを「AiAiが理解したこと」に言い換える（表示用） */
export async function interpretMemosForDisplay(
  memos: MemoInput[]
): Promise<Map<string, string>> {
  const pool = memos
    .filter((m) => m.content.trim() && m.content.trim() !== "なし")
    .slice(0, 5);

  if (pool.length === 0) return new Map();

  const openai = getOpenAIClient();
  if (!openai) {
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
