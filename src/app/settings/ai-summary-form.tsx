"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AiSummaryRow } from "./page";

const MBTI_OPTIONS = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

const GENDER_OPTIONS = ["男性", "女性", "ノンバイナリー", "回答しない"];

const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  initialSummary: AiSummaryRow | null;
};

export default function AiSummaryForm({ initialSummary }: Props) {
  // --- 基本プロフィール ---
  const [gender, setGender] = useState(initialSummary?.gender ?? "");
  const [birthYear, setBirthYear] = useState(
    initialSummary?.birth_year ? String(initialSummary.birth_year) : ""
  );
  const [mbti, setMbti] = useState(initialSummary?.mbti ?? "");
  const [basicValues, setBasicValues] = useState(
    initialSummary?.basic_values ?? ""
  );

  // --- コミュニケーション傾向 ---
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

    const parsedBirthYear = birthYear ? parseInt(birthYear, 10) : null;
    if (birthYear && (isNaN(parsedBirthYear!) || parsedBirthYear! < 1900 || parsedBirthYear! > CURRENT_YEAR)) {
      setError("生まれ年が正しくありません。");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("upsert_ai_summary", {
      communication_style_param: communicationStyle.trim() || null,
      comfortable_phrases_param: comfortablePhrases.trim() || null,
      avoid_phrases_param:       avoidPhrases.trim() || null,
      notes_param:               notes.trim() || null,
      gender_param:              gender || null,
      birth_year_param:          parsedBirthYear,
      mbti_param:                mbti || null,
      basic_values_param:        basicValues.trim() || null,
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

  const textareaFields: {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  }[] = [
    {
      id: "basic_values",
      label: "基本価値観",
      placeholder: "例：家族を大切にする。自由や自立を重視する傾向がある。",
      value: basicValues,
      onChange: setBasicValues,
    },
    {
      id: "communication_style",
      label: "コミュニケーション傾向",
      placeholder: "例：論理的に話すことが多い。感情より事実を優先する傾向がある。",
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
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* --- 基本プロフィール --- */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          基本プロフィール
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* 性別 */}
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              性別
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
            >
              <option value="">選択しない</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 生まれ年 */}
          <div>
            <label htmlFor="birth_year" className="block text-sm font-medium text-gray-700 mb-1">
              生まれ年
            </label>
            <input
              id="birth_year"
              type="number"
              min={1940}
              max={CURRENT_YEAR}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="例：1995"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* MBTI */}
          <div className="col-span-2">
            <label htmlFor="mbti" className="block text-sm font-medium text-gray-700 mb-1">
              MBTI
            </label>
            <select
              id="mbti"
              value={mbti}
              onChange={(e) => setMbti(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
            >
              <option value="">選択しない</option>
              {MBTI_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* --- コミュニケーション傾向 --- */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          コミュニケーション傾向
        </p>
        <div className="space-y-4">
          {textareaFields.map((f) => (
            <div key={f.id}>
              <label
                htmlFor={f.id}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {f.label}
              </label>
              <textarea
                id={f.id}
                rows={2}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
            </div>
          ))}
        </div>
      </div>

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
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← ダッシュボードに戻る
        </Link>
      </div>
    </form>
  );
}
