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
    <main className="min-h-screen bg-gray-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">新しい相談を作成</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              相談タイトル
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：転職について相談したい"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
          >
            {loading ? "作成中..." : "相談を作成する"}
          </button>
        </form>

        <div className="mt-4">
          <Link
            href="/consultations"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← 一覧に戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
