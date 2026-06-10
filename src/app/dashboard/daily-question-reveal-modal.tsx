"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DailyQuestionRoundDetail } from "@/lib/daily-question-types";
import { formatDailyQuestionAnsweredAt } from "@/lib/recent-records";
import DailyQuestionRevealSection from "./daily-question-reveal-section";
import DailyQuestionUnderstandingScore from "./daily-question-understanding-score";

type Props = {
  roundId: string | null;
  onClose: () => void;
};

export default function DailyQuestionRevealModal({ roundId, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<DailyQuestionRoundDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!roundId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/daily-question/round?roundId=${encodeURIComponent(roundId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<DailyQuestionRoundDetail>;
      })
      .then((data) => {
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("内容の読み込みに失敗しました");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [roundId]);

  useEffect(() => {
    if (!roundId) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [roundId, onClose]);

  if (!roundId || !mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="閉じる"
        className="fixed inset-0 z-[100] bg-black/45"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-question-reveal-title"
          className="pointer-events-auto w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border-2 border-rose-100 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
        >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rose-50 bg-white/95 backdrop-blur-sm px-4 py-3.5 rounded-t-2xl">
          <div className="min-w-0">
            <p
              id="daily-question-reveal-title"
              className="text-sm font-black text-gray-800 tracking-tight"
            >
              <span className="text-amber-500">❓</span> ふたり質問
            </p>
            {detail && (
              <p className="text-[10px] text-rose-400/80 mt-0.5 font-bold tabular-nums">
                {formatDailyQuestionAnsweredAt(detail.revealedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {loading && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">読み込み中...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 px-3 rounded-xl border-2 border-dashed border-red-100 bg-red-50/40">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {detail && (
            <>
              <p className="text-[15px] font-bold text-gray-800 leading-snug">
                {detail.question}
              </p>

              <div className="text-center py-2.5 px-3 rounded-xl bg-rose-50/50 border-2 border-rose-100/80">
                <p className="text-sm font-bold text-rose-500">
                  💖 お互いの回答
                </p>
              </div>

              {detail.understanding && (
                <DailyQuestionUnderstandingScore score={detail.understanding} />
              )}

              <DailyQuestionRevealSection
                heading="相手の回答"
                answerLabel="回答"
                answer={detail.partnerAnswer}
                guessLabel="あなたの予想"
                guess={detail.myGuess}
              />

              <DailyQuestionRevealSection
                heading="あなたの回答"
                answerLabel="回答"
                answer={detail.myAnswer}
                guessLabel="相手の予想"
                guess={detail.partnerGuess}
              />
            </>
          )}
        </div>
        </div>
      </div>
    </>,
    document.body
  );
}
