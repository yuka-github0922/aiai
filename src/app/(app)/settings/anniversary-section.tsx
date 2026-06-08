"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Anniversary = {
  id: string;
  title: string;
  date: string;
};

type Props = {
  initialAnniversaries: Anniversary[];
};

export default function AnniversarySection({ initialAnniversaries }: Props) {
  const [list, setList] = useState<Anniversary[]>(initialAnniversaries);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !date) {
      setError("タイトルと日付を入力してください。");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("create_anniversary", {
      title_param: title.trim(),
      date_param: date,
    });
    setSaving(false);

    if (rpcError) {
      setError(`登録に失敗しました: ${rpcError.message}`);
      return;
    }

    // 登録した記念日を一覧に追加
    const newItem: Anniversary = {
      id: data as string,
      title: title.trim(),
      date,
    };
    setList((prev) => [...prev, newItem].sort((a, b) => a.date.localeCompare(b.date)));
    setTitle("");
    setDate("");
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  }

  return (
    <div className="space-y-5">
      {/* 登録済み一覧 */}
      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl"
            >
              <span className="text-sm font-medium text-gray-700">{a.title}</span>
              <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">まだ記念日が登録されていません。</p>
      )}

      {/* 追加フォーム */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ann-title" className="block text-xs font-medium text-gray-600 mb-1">
              タイトル
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：付き合った日"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ann-date" className="block text-xs font-medium text-gray-600 mb-1">
              日付
            </label>
            <input
              id="ann-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="self-start bg-gray-800 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "登録中..." : "追加する"}
        </button>
      </form>
    </div>
  );
}
