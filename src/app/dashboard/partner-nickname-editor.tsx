"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialNickname: string | null;
  joinedAt: string;
};

export default function PartnerNicknameEditor({ initialNickname, joinedAt }: Props) {
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ partner_nickname: draft.trim() || null })
        .eq("id", user.id);
    }
    setNickname(draft.trim());
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(nickname);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-sm shrink-0">
        {nickname?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              placeholder="呼び名を入力"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-rose-400 min-w-0"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2.5 py-1 rounded-lg transition-colors shrink-0"
            >
              {saving ? "…" : "保存"}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-800 truncate">
              {nickname || "（呼び名未設定）"}
            </p>
            <button
              onClick={() => { setDraft(nickname); setEditing(true); }}
              className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              aria-label="呼び名を編集"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          参加日: {new Date(joinedAt).toLocaleDateString("ja-JP")}
        </p>
      </div>
    </div>
  );
}
