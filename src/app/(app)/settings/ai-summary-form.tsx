"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GENDER_OPTIONS } from "@/lib/profile-onboarding-questions";
import type { AiSummaryRow } from "./page";

const MBTI_OPTIONS = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];


const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  initialSummary: AiSummaryRow | null;
  initialDisplayName: string;
  initialPartnerNickname: string;
};

export default function AiSummaryForm({
  initialSummary,
  initialDisplayName,
  initialPartnerNickname,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [partnerNickname, setPartnerNickname] = useState(initialPartnerNickname);

  // --- 基本プロフィール ---
  const [gender, setGender] = useState(initialSummary?.gender ?? "");
  const [birthDate, setBirthDate] = useState(
    initialSummary?.birth_date ??
      (initialSummary?.birth_year
        ? `${initialSummary.birth_year}-01-01`
        : "")
  );
  const [residence, setResidence] = useState(initialSummary?.residence ?? "");
  const [mbti, setMbti] = useState(initialSummary?.mbti ?? "");
  const [animalZodiac, setAnimalZodiac] = useState(initialSummary?.animal_zodiac ?? "");
  const [basicValues, setBasicValues] = useState(
    initialSummary?.basic_values ?? ""
  );
  const [partnerImpression, setPartnerImpression] = useState(
    initialSummary?.partner_impression ?? ""
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

    const parsedBirthYear = birthDate
      ? parseInt(birthDate.slice(0, 4), 10)
      : null;
    if (
      birthDate &&
      (isNaN(parsedBirthYear!) ||
        parsedBirthYear! < 1940 ||
        parsedBirthYear! > CURRENT_YEAR)
    ) {
      setError("生年月日が正しくありません。");
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です。");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        partner_nickname: partnerNickname.trim() || null,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("profiles update error:", profileError);
      setError("名前の保存に失敗しました。");
      setSaving(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("upsert_ai_summary", {
      communication_style_param: communicationStyle.trim() || null,
      comfortable_phrases_param: comfortablePhrases.trim() || null,
      avoid_phrases_param:       avoidPhrases.trim() || null,
      notes_param:               notes.trim() || null,
      gender_param:              gender || null,
      birth_year_param:          parsedBirthYear,
      birth_date_param:          birthDate || null,
      mbti_param:                mbti || null,
      basic_values_param:        basicValues.trim() || null,
      animal_zodiac_param:       animalZodiac || null,
      residence_param:           residence.trim() || null,
      partner_impression_param:  partnerImpression.trim() || null,
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
    router.refresh();
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
      label: "言われると傷つく言葉",
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

      {/* --- あなたの名前 --- */}
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
          あなたの名前
        </label>
        <p className="text-xs text-gray-400 mb-2">
          ホームの「ふたりの恋日記」に表示されます。未入力の場合はメールアドレスの冒頭が使われます。
        </p>
        <input
          id="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例：ゆか、たけし"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      <hr className="border-gray-100" />

      {/* --- パートナーの呼び名 --- */}
      <div>
        <label htmlFor="partner_nickname" className="block text-sm font-medium text-gray-700 mb-1">
          パートナーの呼び名
        </label>
        <p className="text-xs text-gray-400 mb-2">
          あなたがパートナーをどう呼んでいるか入力してください。ダッシュボードに表示されます。
        </p>
        <input
          id="partner_nickname"
          type="text"
          value={partnerNickname}
          onChange={(e) => setPartnerNickname(e.target.value)}
          placeholder="例：たけちゃん、ゆい"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      <hr className="border-gray-100" />

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

          {/* 生年月日 */}
          <div>
            <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1">
              生年月日
            </label>
            <input
              id="birth_date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* 居住地 */}
          <div className="col-span-2">
            <label htmlFor="residence" className="block text-sm font-medium text-gray-700 mb-1">
              居住地
            </label>
            <input
              id="residence"
              type="text"
              value={residence}
              onChange={(e) => setResidence(e.target.value)}
              placeholder="例：東京、大阪の郊外"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>

          {/* MBTI */}
          <div>
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

          {/* 動物占い */}
          <div>
            <label htmlFor="animal_zodiac" className="block text-sm font-medium text-gray-700 mb-1">
              動物占い
            </label>
            <input
              id="animal_zodiac"
              type="text"
              value={animalZodiac}
              onChange={(e) => setAnimalZodiac(e.target.value)}
              placeholder="例：束縛を嫌う黒豹"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      <div>
        <label htmlFor="partner_impression" className="block text-sm font-medium text-gray-700 mb-1">
          あなたから見たパートナー像
        </label>
        <p className="text-xs text-gray-400 mb-2">
          相談の精度を上げるためのメモです。あなただけが見られます。
        </p>
        <textarea
          id="partner_impression"
          rows={2}
          value={partnerImpression}
          onChange={(e) => setPartnerImpression(e.target.value)}
          placeholder="例：慎重だけど、一度決めたら本気。休日はゆっくり派"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
        />
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
          保存しました ✓
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
        <Link href="/home" className="text-sm text-gray-400 hover:text-gray-600">
          ← ホームに戻る
        </Link>
      </div>
    </form>
  );
}
