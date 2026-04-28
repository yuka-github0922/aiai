"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const body = input.trim();
    setInput("");
    setSending(true);
    setError(null);

    const supabase = createClient();
    const { data: newId, error: rpcError } = await supabase.rpc("send_message", {
      consultation_id_param: consultationId,
      body_param: body,
    });

    setSending(false);

    if (rpcError) {
      console.error("send_message error:", rpcError);
      setError("メッセージの送信に失敗しました。もう一度お試しください。");
      setInput(body);
      return;
    }

    const optimisticMessage: Message = {
      id: newId as string,
      user_id: userId,
      role: "user",
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            メッセージを送って相談をスタートしましょう
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.user_id === userId ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.user_id === userId
                  ? "bg-rose-500 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* エラー */}
      {error && (
        <p className="text-xs text-red-500 text-center py-1 bg-red-50">
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
          placeholder="メッセージを入力..."
          disabled={sending}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
        >
          {sending ? "送信中" : "送信"}
        </button>
      </form>
    </div>
  );
}
