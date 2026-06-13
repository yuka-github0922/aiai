import { createClient } from "@/lib/supabase/server";
import { fetchDailyQuestionTimelineEvents } from "@/lib/daily-question-timeline";
import { heuristicMemoUnderstanding } from "@/lib/memo-understanding";
import { buildRecentRecords, type RecentRecord } from "@/lib/recent-records";
import {
  DEFAULT_TIMELINE_PERIOD_FILTER,
  DEFAULT_TIMELINE_SOURCE_FILTER,
  filterRecentRecords,
  type TimelineFilters,
} from "@/lib/timeline-filters";
import { TIMELINE_PAGE_SIZE } from "@/lib/timeline-constants";
import type { AnniversaryRow } from "@/lib/nudge";
import type { MemoForMemory } from "@/lib/ai-memories";

export type TimelinePageResult = {
  records: RecentRecord[];
  total: number;
  hasMore: boolean;
  filters: TimelineFilters;
};

export async function getTimelinePage(
  offset: number,
  limit: number = TIMELINE_PAGE_SIZE,
  filters: TimelineFilters = {
    source: DEFAULT_TIMELINE_SOURCE_FILTER,
    period: DEFAULT_TIMELINE_PERIOD_FILTER,
  }
): Promise<TimelinePageResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return null;

  const [
    { data: rawConsultations },
    { data: rawMemos },
    { data: rawAnniversaries },
    dailyQuestionTimelineEvents,
  ] = await Promise.all([
    supabase
      .from("consultations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_memos")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("anniversaries")
      .select("title, date")
      .eq("couple_id", membership.couple_id),
    fetchDailyQuestionTimelineEvents(supabase, membership.couple_id),
  ]);

  const memos = ((rawMemos ?? []) as MemoForMemory[]).map((memo) => ({
    ...memo,
    displayLabel: heuristicMemoUnderstanding(memo.content) ?? undefined,
  }));

  const allRecords = buildRecentRecords({
    consultations: rawConsultations ?? [],
    memos,
    anniversaries: (rawAnniversaries ?? []) as AnniversaryRow[],
    timelineEvents: dailyQuestionTimelineEvents,
  });

  const filteredRecords = filterRecentRecords(allRecords, filters);
  const total = filteredRecords.length;
  const records = filteredRecords.slice(offset, offset + limit);

  return {
    records,
    total,
    hasMore: offset + records.length < total,
    filters,
  };
}
