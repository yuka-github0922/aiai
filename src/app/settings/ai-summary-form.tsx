"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AiSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
};

type Props = {
  initialSummary: AiSummaryRow | null;
};

export default function AiSummaryForm({ initialSummary }: Props) {
  const [communicationStyle, setCommunicationStyle] = useState(
    initialSummary?.communication_style ?? ""
  );
  const [comfortablePhrases, setComfortablePhrases] = useState(
    initialSummary?.comfortable_phrases ?? ""
  );
  const [avoidPhrases, setAvoidPhrases] = useState(
    initialSummary?.avoid_phrases ?? ""
  );
  const [notes, setNotes] = useState(initialSummary?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("upsert_ai_summary", {
      communication_style_param: communicationStyle.trim() || null,
      comfortable_phrases_param: comfortablePhrases.trim() || null,
      avoid_phrases_param: avoidPhrases.trim() || null,
      notes_param: notes.trim() || null,
    });

    setSaving(false);

    if (rpcError) {
      console.error("upsert_ai_summary error:", rpcError);
      if (rpcError.message.includes("couple not found")) {
        setError("カップルに所属していないため保存できません。");
      } else {
        setError(`保存に失敗しました: ${rpcError.message}`);
      }
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const fields: {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  }[] = [
    {
      id: "communication_style",
      label: "コミュニケーション傾向",
      placeholder:
        "例：論理的に話すことが多い。感情より事実を優先する傾向がある。",
      value: communicationStyle,
      onChange: setCommunicationStyle,
    },
    {
      id: "comfortable_phrases",
      label: "安心しやすい言葉",
      placeholder: '例：「ありがとう」「頑張ったね」など承認の言葉に安心する。',
      value: comfortablePhrases,
      onChange: setComfortablePhrases,
    },
    {
      id: "avoid_phrases",
      label: "避けたい言い方",
      placeholder: '例：「でも」「だって」など言い訳に聞こえる言葉が苦手。',
      value: avoidPhrases,
      onChange: setAvoidPhrases,
    },
    {
      id: "notes",
      label: "その他メモ",
      placeholder: "例：疲れているときは一人の時間が必要。",
      value: notes,
      onChange: setNotes,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((f) => (
        <div key={f.id}>
          <label
            htmlFor={f.id}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <textarea
            id={f.id}
            rows={3}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
          />
        </div>
      ))}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
          保存しました
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
      >
        {saving ? "保存中..." : "保存する"}
      </button>

      <div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>
    </form>
  );
}
