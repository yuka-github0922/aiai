"use client";

import { useRef, useState } from "react";
import Link from "next/link";

const PLACEHOLDERS = [
  "鎌倉に行ってきた",
  "小春が可愛かった",
  "物件見てきた",
] as const;

const STARTER_CHIPS = [
  { label: "今日", text: "今日、" },
  { label: "週末", text: "週末、" },
  { label: "最近", text: "最近、" },
] as const;

type Props = {
  consultationId: string;
};

type ComposerState = "idle" | "sending" | "waiting_ai";

export default function CasualChatComposer({ consultationId }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ComposerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastAiReply, setLastAiReply] = useState<string | null>(null);
  const placeholder =
    PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body || state !== "idle") return;

    setState("sending");
    setError(null);
    setLastAiReply(null);

    try {
      const messageRes = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, message: body }),
      });

      if (!messageRes.ok) {
        const data = await messageRes.json().catch(() => ({}));
        throw new Error(data.error ?? "送信に失敗しました");
      }

      setInput("");
      setState("waiting_ai");

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
      });

      if (!chatRes.ok) {
        const data = await chatRes.json().catch(() => ({}));
        throw new Error(data.error ?? "AIの返答取得に失敗しました");
      }

      const aiMessage = (await chatRes.json()) as { body: string };
      setLastAiReply(aiMessage.body);
    } catch (err) {
      console.error("[CasualChatComposer]", err);
      setError(
        err instanceof Error ? err.message : "送信に失敗しました。もう一度お試しください。"
      );
      setInput(body);
    } finally {
      setState("idle");
    }
  }

  const isBusy = state !== "idle";

  function applyStarter(starter: string) {
    setInput(starter);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(starter.length, starter.length);
    });
  }

  return (
    <div className="mt-5 pt-4 border-t border-rose-100/80">
      <p className="text-[10px] text-center text-rose-400/80 tracking-wide mb-2.5">
        相談ほどじゃない日常も、ここにそっと残せるよ
      </p>

      <div className="flex flex-wrap justify-center gap-1.5 mb-2.5">
        {STARTER_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            disabled={isBusy}
            onClick={() => applyStarter(chip.text)}
            className="text-[10px] px-2.5 py-1 rounded-full border border-rose-100 bg-white/90 text-rose-500/90 font-semibold hover:border-rose-200 disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isBusy}
          className="flex-1 min-w-0 border-2 border-rose-100 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="shrink-0 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          {state === "sending"
            ? "送信中"
            : state === "waiting_ai"
              ? "考え中"
              : "送る"}
        </button>
      </form>

      {error ? (
        <p className="text-[11px] text-red-500 text-center mt-2">{error}</p>
      ) : null}

      {lastAiReply ? (
        <div className="mt-3 rounded-xl bg-rose-50/70 border border-rose-100 px-3.5 py-3">
          <p className="text-[10px] font-bold text-rose-400/90 mb-1">AiAi</p>
          <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
            {lastAiReply}
          </p>
          <Link
            href={`/consultations/${consultationId}`}
            className="inline-block mt-2.5 text-[11px] font-bold text-rose-500 hover:text-rose-600"
          >
            続きを話す →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
