"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  submitDailyQuestionAnswer,
  submitDailyQuestionGuess,
} from "./daily-question-actions";
import {
  DAILY_QUESTION_MAX_LENGTH,
  type DailyQuestionState,
  type DailyQuestionVisible,
} from "@/lib/daily-question-types";

type Props = {
  initialState: DailyQuestionVisible;
};

function WaitingMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-5 px-3 rounded-xl border-2 border-dashed border-amber-200/60 bg-amber-50/30">
      <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
    </div>
  );
}

function TextSubmitForm({
  label,
  placeholder,
  buttonLabel,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  buttonLabel: string;
  onSubmit: (value: string) => Promise<{ error: string | null }>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
          {label}
        </label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={2}
          maxLength={DAILY_QUESTION_MAX_LENGTH}
          disabled={isPending}
          className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white resize-none"
        />
        <p className="text-[10px] text-gray-400 text-right mt-1 tabular-nums">
          {value.length}/{DAILY_QUESTION_MAX_LENGTH}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !value.trim()}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors text-sm"
      >
        {isPending ? "送信中..." : buttonLabel}
      </button>
    </form>
  );
}

function RevealSection({
  heading,
  answerLabel,
  answer,
  guessLabel,
  guess,
}: {
  heading: string;
  answerLabel: string;
  answer: string;
  guessLabel: string;
  guess: string;
}) {
  return (
    <div className="rounded-xl border-2 border-rose-100/80 bg-gradient-to-r from-rose-50/60 to-white px-4 py-3.5 space-y-3">
      <p className="text-[12px] font-black text-rose-500/90">{heading}</p>
      <div>
        <p className="text-[10px] font-bold text-gray-400 mb-1">{answerLabel}</p>
        <p className="text-[13px] text-gray-700 leading-snug font-medium">
          「{answer}」
        </p>
      </div>
      <div className="pt-1 border-t border-rose-100/60">
        <p className="text-[10px] font-bold text-gray-400 mb-1 mt-2">
          {guessLabel}
        </p>
        <p className="text-[13px] text-gray-700 leading-snug font-medium">
          「{guess}」
        </p>
      </div>
    </div>
  );
}

export default function DailyQuestionCard({ initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);

  async function handleSubmit(
    action: (value: string) => Promise<{
      state: DailyQuestionState | null;
      error: string | null;
    }>,
    value: string
  ) {
    const result = await action(value);
    if (!result.error && result.state?.visible) {
      setState(result.state);
      router.refresh();
    }
    return { error: result.error };
  }

  return (
    <section className="aiai-sticker-card px-4 py-5">
      <div className="mb-4">
        <p className="text-sm font-black text-gray-800 tracking-tight">
          <span className="text-amber-500">❓</span> 今日のふたり質問
        </p>
        <p className="text-[10px] text-amber-500/60 mt-1 tracking-wide">
          ふたりの理解度を、少しずつ深めていくよ
        </p>
      </div>

      <p className="text-[15px] font-bold text-gray-800 leading-snug mb-4">
        {state.question}
      </p>

      {state.phase === "needs_my_answer" && (
        <TextSubmitForm
          label="あなたの回答"
          placeholder="例：小春を大切にしてくれるところ"
          buttonLabel="回答する"
          onSubmit={(value) => handleSubmit(submitDailyQuestionAnswer, value)}
        />
      )}

      {state.phase === "needs_my_guess" && (
        <div className="space-y-4">
          <div className="text-center py-3 px-3 rounded-xl bg-violet-50/40 border-2 border-violet-100/70">
            <p className="text-sm font-bold text-gray-700">
              🎯 相手はどう答えたと思う？
            </p>
            <p className="text-xs text-gray-500 mt-1">
              相手の回答を待たずに、先に予想できます
            </p>
          </div>
          <TextSubmitForm
            label="あなたの予想"
            placeholder="例：休日を大切にしてくれるところ"
            buttonLabel="予想する"
            onSubmit={(value) => handleSubmit(submitDailyQuestionGuess, value)}
          />
        </div>
      )}

      {state.phase === "waiting_partner" && (
        <WaitingMessage>
          ⏳ 相手の入力待ち
          <br />
          <span className="text-xs text-gray-500">
            ふたりの回答と予想が揃うと、お互いの内容が開示されます
          </span>
        </WaitingMessage>
      )}

      {state.phase === "revealed" &&
        state.partnerAnswer &&
        state.myGuess &&
        state.myAnswer &&
        state.partnerGuess && (
          <div className="space-y-3">
            <div className="text-center py-3 px-3 rounded-xl bg-rose-50/50 border-2 border-rose-100/80 mb-1">
              <p className="text-sm font-bold text-rose-500">
                💖 お互いの回答を確認しました
              </p>
            </div>

            <RevealSection
              heading="相手の回答"
              answerLabel="回答"
              answer={state.partnerAnswer}
              guessLabel="あなたの予想"
              guess={state.myGuess}
            />

            <RevealSection
              heading="あなたの回答"
              answerLabel="回答"
              answer={state.myAnswer}
              guessLabel="相手の予想"
              guess={state.partnerGuess}
            />
          </div>
        )}
    </section>
  );
}
