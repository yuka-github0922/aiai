"use client";

import { useCallback, useState } from "react";
import type { RecentRecord } from "@/lib/recent-records";
import { TIMELINE_PAGE_SIZE } from "@/lib/timeline-constants";
import {
  buildTimelineSearchParams,
  DEFAULT_TIMELINE_PERIOD_FILTER,
  DEFAULT_TIMELINE_SOURCE_FILTER,
  TIMELINE_PERIOD_OPTIONS,
  TIMELINE_SOURCE_OPTIONS,
  timelineEmptyMessage,
  type TimelineFilters,
  type TimelinePeriodFilter,
  type TimelineSourceFilter,
} from "@/lib/timeline-filters";
import DailyQuestionRevealModal from "./daily-question-reveal-modal";

type Props = {
  initialRecords: RecentRecord[];
  initialHasMore: boolean;
  initialTotal: number;
  initialFilters?: TimelineFilters;
  pageSize?: number;
};

const NODE_STYLES = [
  "bg-rose-200 border-rose-100",
  "bg-amber-100 border-amber-50",
  "bg-violet-200 border-violet-100",
  "bg-sky-200 border-sky-100",
  "bg-pink-200 border-pink-100",
] as const;

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
        active
          ? "border-violet-300 bg-violet-100 text-violet-700"
          : "border-gray-200 bg-white text-gray-500 hover:border-violet-200 hover:text-violet-500"
      }`}
    >
      {label}
    </button>
  );
}

function TimelineList({
  records,
  onDailyQuestionClick,
}: {
  records: RecentRecord[];
  onDailyQuestionClick: (roundId: string) => void;
}) {
  return (
    <ol className="relative ml-1 space-y-4">
      <span
        className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-rose-200/80 via-violet-200/60 to-transparent"
        aria-hidden="true"
      />

      {records.map((record, index) => {
        const nodeStyle = NODE_STYLES[index % NODE_STYLES.length];
        const isDailyQuestion = record.source === "daily_question";

        const content = (
          <>
            <div className="relative z-10 shrink-0 pt-0.5">
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full border-2 text-[13px] shadow-sm ${nodeStyle}`}
                aria-hidden="true"
              >
                {record.icon}
              </span>
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-[11px] font-bold text-rose-400/75 tabular-nums tracking-wide">
                {record.dateLabel}
              </p>
              <p
                className={`text-[13px] leading-snug font-medium mt-0.5 ${
                  isDailyQuestion
                    ? "text-rose-600/90 group-hover:text-rose-600"
                    : "text-gray-700"
                }`}
              >
                {record.title}
              </p>
              {isDailyQuestion && (
                <p className="text-[10px] text-rose-400/70 font-bold mt-1">
                  タップして内容を見る →
                </p>
              )}
            </div>
          </>
        );

        return (
          <li key={record.id} className="relative pl-0.5">
            {isDailyQuestion ? (
              <button
                type="button"
                onClick={() => onDailyQuestionClick(record.sourceRef)}
                className="group flex w-full gap-3 text-left rounded-xl -mx-1 px-1 py-1 hover:bg-rose-50/50 transition-colors"
              >
                {content}
              </button>
            ) : (
              <div className="flex gap-3">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function RecentRecordsSection({
  initialRecords,
  initialHasMore,
  initialTotal,
  initialFilters = {
    source: DEFAULT_TIMELINE_SOURCE_FILTER,
    period: DEFAULT_TIMELINE_PERIOD_FILTER,
  },
  pageSize = TIMELINE_PAGE_SIZE,
}: Props) {
  const [filters, setFilters] = useState<TimelineFilters>(initialFilters);
  const [records, setRecords] = useState(initialRecords);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const remaining = Math.max(0, total - records.length);

  const fetchTimeline = useCallback(
    async (nextFilters: TimelineFilters, offset: number, append: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const params = buildTimelineSearchParams(nextFilters, offset, pageSize);
        const res = await fetch(`/api/timeline?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: {
          records: RecentRecord[];
          total: number;
          hasMore: boolean;
          filters: TimelineFilters;
        } = await res.json();

        setFilters(data.filters);
        setRecords((prev) =>
          append ? [...prev, ...data.records] : data.records
        );
        setHasMore(data.hasMore);
        setTotal(data.total);
      } catch {
        setError("読み込みに失敗しました。もう一度お試しください。");
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  function applySourceFilter(source: TimelineSourceFilter) {
    if (source === filters.source || loading) return;
    void fetchTimeline({ ...filters, source }, 0, false);
  }

  function applyPeriodFilter(period: TimelinePeriodFilter) {
    if (period === filters.period || loading) return;
    void fetchTimeline({ ...filters, period }, 0, false);
  }

  function loadMore() {
    if (loading || !hasMore) return;
    void fetchTimeline(filters, records.length, true);
  }

  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-black text-gray-800 tracking-tight">
            <span className="text-violet-400">📖</span> 最近のきろく
          </p>
          <p className="text-[10px] text-violet-400/60 mt-1 tracking-wide">
            ふたりの日記帳 — 少しずつ、歴史が増えていくよ
          </p>
        </div>
        <span
          className="shrink-0 text-violet-300 text-sm"
          aria-hidden="true"
        >
          🔖
        </span>
      </div>

      <div className="mb-4 space-y-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-wide">
            種類
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TIMELINE_SOURCE_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={filters.source === option.value}
                onClick={() => applySourceFilter(option.value)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-wide">
            期間
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TIMELINE_PERIOD_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={filters.period === option.value}
                onClick={() => applyPeriodFilter(option.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {loading && records.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">読み込み中...</div>
      ) : records.length > 0 ? (
        <>
          <TimelineList
            records={records}
            onDailyQuestionClick={setSelectedRoundId}
          />

          {hasMore && (
            <div className="mt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-violet-200/70 bg-violet-50/30 text-xs font-bold text-violet-500 hover:bg-violet-50/50 hover:border-violet-300/70 transition-colors disabled:opacity-60"
              >
                {loading ? (
                  "読み込み中..."
                ) : (
                  <>
                    <span aria-hidden="true">▼</span>
                    もっと見る
                    <span className="text-violet-400/70 font-semibold tabular-nums">
                      （あと{remaining}件）
                    </span>
                  </>
                )}
              </button>
              {error && (
                <p className="text-[11px] text-red-500 text-center mt-2">
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6 px-3 rounded-xl border-2 border-dashed border-violet-200/50 bg-violet-50/20">
          <p className="text-sm text-gray-500 leading-relaxed">
            {timelineEmptyMessage(filters)}
          </p>
        </div>
      )}

      <p className="text-[10px] font-bold text-amber-400/70 text-right mt-3 tracking-widest">
        04
      </p>

      <DailyQuestionRevealModal
        roundId={selectedRoundId}
        onClose={() => setSelectedRoundId(null)}
      />
    </section>
  );
}
