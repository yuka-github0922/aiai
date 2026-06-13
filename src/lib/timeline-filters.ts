import type { RecentRecord, RecentRecordSource } from "@/lib/recent-records";

export type TimelineSourceFilter = RecentRecordSource | "all";

export type TimelinePeriodFilter = "all" | "7d" | "30d" | "90d" | "365d";

export type TimelineFilters = {
  source: TimelineSourceFilter;
  period: TimelinePeriodFilter;
};

export const DEFAULT_TIMELINE_SOURCE_FILTER: TimelineSourceFilter =
  "daily_question";
export const DEFAULT_TIMELINE_PERIOD_FILTER: TimelinePeriodFilter = "all";

const SOURCE_FILTERS: TimelineSourceFilter[] = [
  "all",
  "daily_question",
  "consultation",
  "memo",
  "anniversary",
];

const PERIOD_FILTERS: TimelinePeriodFilter[] = [
  "all",
  "7d",
  "30d",
  "90d",
  "365d",
];

export const TIMELINE_SOURCE_OPTIONS: {
  value: TimelineSourceFilter;
  label: string;
}[] = [
  { value: "daily_question", label: "質問" },
  { value: "all", label: "すべて" },
  { value: "consultation", label: "相談" },
  { value: "memo", label: "メモ" },
  { value: "anniversary", label: "記念日" },
];

export const TIMELINE_PERIOD_OPTIONS: {
  value: TimelinePeriodFilter;
  label: string;
}[] = [
  { value: "all", label: "すべて" },
  { value: "7d", label: "7日" },
  { value: "30d", label: "30日" },
  { value: "90d", label: "3ヶ月" },
  { value: "365d", label: "1年" },
];

export function parseTimelineSourceFilter(
  value: string | null | undefined
): TimelineSourceFilter {
  if (value && SOURCE_FILTERS.includes(value as TimelineSourceFilter)) {
    return value as TimelineSourceFilter;
  }
  return DEFAULT_TIMELINE_SOURCE_FILTER;
}

export function parseTimelinePeriodFilter(
  value: string | null | undefined
): TimelinePeriodFilter {
  if (value && PERIOD_FILTERS.includes(value as TimelinePeriodFilter)) {
    return value as TimelinePeriodFilter;
  }
  return DEFAULT_TIMELINE_PERIOD_FILTER;
}

export function parseTimelineFilters(
  searchParams: URLSearchParams
): TimelineFilters {
  return {
    source: parseTimelineSourceFilter(searchParams.get("source")),
    period: parseTimelinePeriodFilter(searchParams.get("period")),
  };
}

function periodCutoff(period: TimelinePeriodFilter, now = new Date()): Date | null {
  if (period === "all") return null;

  const days =
    period === "7d"
      ? 7
      : period === "30d"
        ? 30
        : period === "90d"
          ? 90
          : 365;

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

export function filterRecentRecords(
  records: RecentRecord[],
  filters: TimelineFilters
): RecentRecord[] {
  let filtered = records;

  if (filters.source !== "all") {
    filtered = filtered.filter((record) => record.source === filters.source);
  }

  const cutoff = periodCutoff(filters.period);
  if (cutoff) {
    filtered = filtered.filter((record) => new Date(record.date) >= cutoff);
  }

  return filtered;
}

export function buildTimelineSearchParams(
  filters: TimelineFilters,
  offset: number,
  limit: number
): URLSearchParams {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    source: filters.source,
    period: filters.period,
  });

  return params;
}

export function timelineEmptyMessage(filters: TimelineFilters): string {
  if (filters.source === "daily_question") {
    return filters.period === "all"
      ? "ふたり質問に答えると、ここにきろくが残るよ"
      : "この期間のふたり質問はまだないよ";
  }

  if (filters.source === "consultation") {
    return "相談が増えると、ここにきろくが並んでいくよ";
  }

  if (filters.source === "memo") {
    return "相談から拾ったメモが、ここに残っていくよ";
  }

  if (filters.source === "anniversary") {
    return "記念日や付き合ってからの節目が、ここに並ぶよ";
  }

  return filters.period === "all"
    ? "相談や記念日が増えると、ふたりのきろくがここに並んでいくよ"
    : "この期間のきろくはまだないよ";
}
