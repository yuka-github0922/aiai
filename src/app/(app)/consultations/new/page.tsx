"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NewConsultationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: newId, error: rpcError } = await supabase.rpc(
      "create_consultation_for_user",
      { title_param: title.trim() }
    );

    setLoading(false);

    if (rpcError) {
      console.error("create_consultation_for_user error:", rpcError);
      if (rpcError.message.includes("couple not found")) {
        setError("カップルに所属していないため相談を作成できません。");
      } else if (rpcError.message.includes("authentication required")) {
        setError("ログインが必要です。");
      } else {
        setError(`相談の作成に失敗しました: ${rpcError.message}`);
      }
      return;
    }

    router.push(`/consultations/${newId}`);
  }

  return (
    <main className="min-h-screen aiai-dashboard-bg">
      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/consultations"
            className="text-gray-400 hover:text-rose-500 text-lg font-bold"
            aria-label="相談一覧に戻る"
          >
            ←
          </Link>
          <h1 className="text-base font-black text-gray-800">新しい相談</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <section className="aiai-sticker-card px-5 py-6">
          <p className="text-[10px] text-rose-400/70 mb-5 text-center tracking-wide">
            話すほど、AiAiがふたりのことを覚えていくよ
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-bold text-gray-700 mb-1.5"
              >
                相談タイトル
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：最近のすれ違いについて"
                required
                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="aiai-cta-seventeen w-full text-center px-5 py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="block text-base font-black text-white">
                {loading ? "作成中..." : "相談をはじめる"}
              </span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
