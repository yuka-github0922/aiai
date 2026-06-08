import { heuristicMemoUnderstanding } from "@/lib/memo-understanding";
import type { InsightRow, MemoRow } from "@/lib/nudge";

export type AiMemorySource = "memo" | "insight";

export type AiMemoryItem = {
  id: string;
  emoji: string;
  label: string;
  source: AiMemorySource;
  sourceRef: string;
  createdAt: string;
};

export type MemoForMemory = Pick<MemoRow, "content" | "created_at"> & {
  id?: string;
  /** interpretMemosForDisplay() で言い換えた表示用ラベル */
  displayLabel?: string;
};

export type BuildAiMemoriesInput = {
  memos: MemoForMemory[];
  insights: Pick<InsightRow, "partner_hint" | "created_at">[];
};

export type BuildAiMemoriesOptions = {
  maxMemos?: number;
  maxInsights?: number;
  maxTotal?: number;
};

const MAX_LABEL_LENGTH = 30;
const HOME_MAX_MEMOS = 2;
const HOME_MAX_INSIGHTS = 1;
const HOME_MAX_TOTAL = 3;

/** partner_memos と partner insights の合計件数 */
export function countAiMemories(memoCount: number, insightCount: number): number {
  return memoCount + insightCount;
}

export function buildAiMemories(
  input: BuildAiMemoriesInput,
  options?: BuildAiMemoriesOptions
): AiMemoryItem[] {
  const maxMemos = options?.maxMemos ?? HOME_MAX_MEMOS;
  const maxInsights = options?.maxInsights ?? HOME_MAX_INSIGHTS;
  const maxTotal = options?.maxTotal ?? HOME_MAX_TOTAL;

  const fromMemos = memoriesFromMemos(input.memos, maxMemos);
  const insightSlots = Math.min(maxInsights, maxTotal - fromMemos.length);
  const fromInsights = memoriesFromInsights(input.insights, insightSlots);

  return [...fromMemos, ...fromInsights].slice(0, maxTotal);
}

/** 作成日時の新しい順に最大 limit 件（ホーム用） */
export function buildAiMemoriesLatest(
  input: BuildAiMemoriesInput,
  limit = 5
): AiMemoryItem[] {
  const fromMemos = memoriesFromMemos(input.memos, input.memos.length);
  const fromInsights = memoriesFromInsights(
    input.insights,
    input.insights.length
  );

  return [...fromMemos, ...fromInsights]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
}

function memoriesFromMemos(memos: MemoForMemory[], limit: number): AiMemoryItem[] {
  const result: AiMemoryItem[] = [];

  for (const memo of memos) {
    const understood =
      memo.displayLabel ??
      heuristicMemoUnderstanding(memo.content) ??
      memo.content;
    const label = formatLabel(understood);
    if (!label) continue;

    result.push({
      id: `memo-${memo.id ?? memo.created_at}`,
      emoji: emojiForMemo(label),
      label,
      source: "memo",
      sourceRef: memo.id ?? memo.created_at,
      createdAt: memo.created_at,
    });

    if (result.length >= limit) break;
  }

  return result;
}

function memoriesFromInsights(
  insights: Pick<InsightRow, "partner_hint" | "created_at">[],
  limit: number
): AiMemoryItem[] {
  if (limit <= 0) return [];

  const result: AiMemoryItem[] = [];

  for (const insight of insights) {
    const label = formatLabel(insight.partner_hint);
    if (!label) continue;

    result.push({
      id: `insight-${insight.created_at}`,
      emoji: emojiForInsight(label),
      label,
      source: "insight",
      sourceRef: insight.created_at,
      createdAt: insight.created_at,
    });

    if (result.length >= limit) break;
  }

  return result;
}

function formatLabel(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "なし") return null;
  if (trimmed.length <= MAX_LABEL_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function emojiForMemo(label: string): string {
  if (/犬|猫|ペット|小春|家族|うさぎ|ハムスタ/.test(label)) return "🐶";
  if (/同棲|暮らし|住|引っ越|家/.test(label)) return "🏠";
  if (/時間を大切|一緒の時間|デート|遊び/.test(label)) return "🎢";
  if (/気持ち|プレゼント|サプライズ|贈り/.test(label)) return "🎁";
  if (/食|ご飯|料理|レストラン|カフェ/.test(label)) return "🍽️";
  if (/記念日|誕生日|周年/.test(label)) return "🎂";
  return "✨";
}

function emojiForInsight(label: string): string {
  if (/安心|共感|嬉しい|幸せ|落ち着|温か/.test(label)) return "😊";
  if (/話せ|伝え|本音|コミュニケーション|会話/.test(label)) return "💬";
  if (/信頼|寄り添|理解|支え/.test(label)) return "🤝";
  return "💭";
}
