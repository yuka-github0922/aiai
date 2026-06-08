"use client";

import { useState } from "react";
import type { RecentRecord } from "@/lib/recent-records";
import { TIMELINE_PAGE_SIZE } from "@/lib/timeline-constants";

type Props = {
  initialRecords: RecentRecord[];
  initialHasMore: boolean;
  initialTotal: number;
  pageSize?: number;
};

const NODE_STYLES = [
  "bg-rose-200 border-rose-100",
  "bg-amber-100 border-amber-50",
  "bg-violet-200 border-violet-100",
  "bg-sky-200 border-sky-100",
  "bg-pink-200 border-pink-100",
] as const;

function TimelineList({ records }: { records: RecentRecord[] }) {
  return (
    <ol className="relative ml-1 space-y-4">
      <span
        className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-rose-200/80 via-violet-200/60 to-transparent"
        aria-hidden="true"
      />

      {records.map((record, index) => {
        const nodeStyle = NODE_STYLES[index % NODE_STYLES.length];

        return (
          <li key={record.id} className="relative flex gap-3 pl-0.5">
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
              <p className="text-[13px] text-gray-700 leading-snug font-medium mt-0.5">
                {record.title}
              </p>
            </div>
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
  pageSize = TIMELINE_PAGE_SIZE,
}: Props) {
  const [records, setRecords] = useState(initialRecords);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, total - records.length);

  async function loadMore() {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/timeline?offset=${records.length}&limit=${pageSize}`
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: {
        records: RecentRecord[];
        total: number;
        hasMore: boolean;
      } = await res.json();

      setRecords((prev) => [...prev, ...data.records]);
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch {
      setError("読み込みに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="flex items-start justify-between gap-2 mb-4">
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

      {records.length > 0 ? (
        <>
          <TimelineList records={records} />

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
            相談や記念日が増えると、ふたりのきろくがここに並んでいくよ
          </p>
        </div>
      )}

      <p className="text-[10px] font-bold text-amber-400/70 text-right mt-3 tracking-widest">
        04
      </p>
    </section>
  );
}
