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

type ChatState = "idle" | "sending" | "waiting_ai";

export default function ChatPanel({
  consultationId,
  initialMessages,
  userId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [notice, setNotice] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isInputDisabled = chatState !== "idle";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatState]);

  // textarea の高さを内容に合わせて自動調整
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (!isTouchDevice) {
        e.preventDefault();
        handleSend(e as unknown as React.FormEvent);
      }
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || chatState !== "idle") return;

    const body = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setChatState("sending");
    setNotice(null);

    // 1. ユーザーメッセージを暗号化保存
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
      setChatState("idle");
      setNotice({ type: "error", text: "メッセージの送信に失敗しました。もう一度お試しください。" });
      setInput(body);
      return;
    }

    setMessages((prev) => [...prev, userMessage]);
    setChatState("waiting_ai");

    // 2. AI 返答を取得（AbortController で停止可能）
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const aiMessage: Message = await res.json();
      setMessages((prev) => [...prev, aiMessage]);
      setNotice(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setNotice({ type: "info", text: "AI応答を停止しました" });
      } else {
        console.error("AI fetch error:", err);
        setNotice({ type: "error", text: "AIの返答取得に失敗しました。しばらくしてからお試しください。" });
      }
    } finally {
      setChatState("idle");
      abortControllerRef.current = null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && chatState === "idle" && (
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
        {chatState === "waiting_ai" && (
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

      {/* お知らせ（停止 / エラー） */}
      {notice && (
        <p
          className={`text-xs text-center py-1.5 px-4 border-t ${
            notice.type === "error"
              ? "text-red-500 bg-red-50 border-red-100"
              : "text-gray-500 bg-gray-50 border-gray-100"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* 送信フォーム */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 px-4 py-3 flex gap-2 bg-white items-end"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={chatState === "waiting_ai" ? "AIが考え中..." : "メッセージを入力..."}
          disabled={isInputDisabled}
          className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-100 disabled:text-gray-400 resize-none overflow-hidden max-h-40 leading-relaxed"
        />

        {chatState === "waiting_ai" ? (
          <button
            type="button"
            onClick={handleStop}
            className="shrink-0 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors flex items-center gap-1.5"
          >
            <span className="w-3 h-3 bg-white rounded-sm inline-block" />
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={chatState !== "idle" || !input.trim()}
            className="shrink-0 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            {chatState === "sending" ? "送信中" : "送信"}
          </button>
        )}
      </form>
    </div>
  );
}
