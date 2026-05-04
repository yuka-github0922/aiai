"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  user_id: string;
  role: string;
  body: string;
  created_at: string;
};

type Props = {
  consultationId: string;
  initialMessages: Message[];
  userId: string;
};

export default function ChatPanel({
  consultationId,
  initialMessages,
  userId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading]);

  const isDisabled = sending || aiLoading;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isDisabled) return;

    const body = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    // 1. サーバー経由でユーザーメッセージを暗号化保存
    let userMessage: Message;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId, message: body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      userMessage = await res.json();
    } catch (err) {
      console.error("send message error:", err);
      setSending(false);
      setError("メッセージの送信に失敗しました。もう一度お試しください。");
      setInput(body);
      return;
    }

    setSending(false);

    // 2. ローカル state にオプティミスティック追加
    setMessages((prev) => [...prev, userMessage]);

    // 3. AI 返答を取得
    setAiLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const aiMessage: Message = await res.json();
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error("AI fetch error:", err);
      setError("AI の返答取得に失敗しました。しばらくしてからお試しください。");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !aiLoading && (
          <p className="text-center text-gray-400 text-sm py-8">
            メッセージを送って相談をスタートしましょう
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <span className="text-xs text-gray-400 self-end mr-1 mb-1">AI</span>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-rose-500 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.body}
            </div>
          </div>
        ))}

        {/* AI タイピングインジケーター */}
        {aiLoading && (
          <div className="flex justify-start">
            <span className="text-xs text-gray-400 self-end mr-1 mb-1">AI</span>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* エラー */}
      {error && (
        <p className="text-xs text-red-500 text-center py-1 bg-red-50 px-4">
          {error}
        </p>
      )}

      {/* 送信フォーム */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 px-4 py-3 flex gap-2 bg-white"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={aiLoading ? "AIが考え中..." : "メッセージを入力..."}
          disabled={isDisabled}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
        >
          {sending ? "送信中" : "送信"}
        </button>
      </form>
    </div>
  );
}
