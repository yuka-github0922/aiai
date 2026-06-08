import { heuristicMemoUnderstanding } from "@/lib/memo-understanding";
import type { AnniversaryRow } from "@/lib/nudge";
import type { MemoForMemory } from "@/lib/ai-memories";
import { getRelationshipStart } from "@/lib/couple-stats";

export type RecentRecordSource =
  | "consultation"
  | "memo"
  | "anniversary";

export type RecentRecord = {
  id: string;
  date: string;
  dateLabel: string;
  icon: string;
  title: string;
  source: RecentRecordSource;
  sourceRef: string;
};

export type ConsultationForRecord = {
  id: string;
  title: string;
  updated_at: string;
};

export type BuildRecentRecordsInput = {
  /** 自分の相談のみ（user_id で絞り込み済みであること） */
  consultations: ConsultationForRecord[];
  /** 自分の相談から抽出されたメモのみ */
  memos: MemoForMemory[];
  /** カップル共有の記念日 */
  anniversaries: AnniversaryRow[];
  limit?: number;
};

const MAX_TITLE_LENGTH = 42;
const RELATIONSHIP_TITLE_PATTERN = /付き合|交際|恋愛|付合/;
const DAY_MILESTONES = [30, 50, 80, 100, 150, 200, 365, 500, 730];

export function buildRecentRecords(input: BuildRecentRecordsInput): RecentRecord[] {
  const today = startOfDay(new Date());

  const events: RecentRecord[] = [
    ...recordsFromConsultations(input.consultations),
    ...recordsFromMemos(input.memos),
    ...recordsFromAnniversaries(input.anniversaries, today),
  ];

  const sorted = events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (input.limit === undefined) return sorted;
  return sorted.slice(0, input.limit);
}

function recordsFromConsultations(
  consultations: ConsultationForRecord[]
): RecentRecord[] {
  return consultations.map((c) => ({
    id: `consultation-${c.id}`,
    date: c.updated_at,
    dateLabel: formatRecordDate(c.updated_at),
    icon: "💬",
    title: formatConsultationTitle(c.title),
    source: "consultation",
    sourceRef: c.id,
  }));
}

function recordsFromMemos(memos: MemoForMemory[]): RecentRecord[] {
  const result: RecentRecord[] = [];

  for (const memo of memos) {
    const understood =
      memo.displayLabel ??
      heuristicMemoUnderstanding(memo.content) ??
      memo.content;
    const label = formatTitleFragment(understood);
    if (!label) continue;

    result.push({
      id: `memo-${memo.id ?? memo.created_at}`,
      date: memo.created_at,
      dateLabel: formatRecordDate(memo.created_at),
      icon: emojiForMemo(label),
      title: `${label}ことをAiAiが覚えた`,
      source: "memo",
      sourceRef: memo.id ?? memo.created_at,
    });
  }

  return result;
}

function recordsFromAnniversaries(
  anniversaries: AnniversaryRow[],
  today: Date
): RecentRecord[] {
  const result: RecentRecord[] = [];
  const relationshipStart = getRelationshipStart(anniversaries);

  if (relationshipStart) {
    const startMid = startOfDay(relationshipStart);
    if (startMid <= today) {
      result.push({
        id: `anniversary-start-${startMid.toISOString()}`,
        date: startMid.toISOString(),
        dateLabel: formatRecordDate(startMid.toISOString()),
        icon: "💕",
        title: "付き合いが始まった",
        source: "anniversary",
        sourceRef: "relationship-start",
      });
    }

    for (const days of DAY_MILESTONES) {
      const milestoneDate = addDays(startMid, days);
      if (milestoneDate > today) continue;

      result.push({
        id: `milestone-${days}`,
        date: milestoneDate.toISOString(),
        dateLabel: formatRecordDate(milestoneDate.toISOString()),
        icon: "❤️",
        title: `付き合って${days}日`,
        source: "anniversary",
        sourceRef: `milestone-${days}`,
      });
    }
  }

  for (const anniversary of anniversaries) {
    const date = startOfDay(new Date(anniversary.date));
    if (date > today) continue;
    if (relationshipStart && RELATIONSHIP_TITLE_PATTERN.test(anniversary.title)) {
      continue;
    }

    result.push({
      id: `anniversary-${anniversary.title}-${anniversary.date}`,
      date: date.toISOString(),
      dateLabel: formatRecordDate(date.toISOString()),
      icon: "🎂",
      title: anniversary.title,
      source: "anniversary",
      sourceRef: anniversary.date,
    });
  }

  return result;
}

function formatConsultationTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "AiAiと相談した";
  if (/相談した$/.test(trimmed)) return trimmed;
  if (/について$/.test(trimmed)) return `${trimmed}相談した`;
  if (/相談/.test(trimmed)) return trimmed;
  return `${trimmed}について相談した`;
}

function formatTitleFragment(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "なし") return null;
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

function formatRecordDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
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
