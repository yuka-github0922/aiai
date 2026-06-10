"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  MBTI_OPTIONS,
  getProfileOnboardingQuestion,
} from "@/lib/profile-onboarding-questions";
import {
  buildProfileOnboardingProgress,
  countProfileOnboardingAnswered,
  getNextWizardField,
  getPreviousWizardField,
} from "@/lib/profile-onboarding-state";
import {
  PROFILE_ONBOARDING_FIELD_KEYS,
  PROFILE_ONBOARDING_TOTAL,
} from "@/lib/profile-onboarding-types";
import type {
  ProfileOnboardingData,
  ProfileOnboardingFieldKey,
} from "@/lib/profile-onboarding-types";
import {
  completeProfileOnboarding,
  dismissProfileOnboarding,
  saveProfileOnboardingAnswer,
  skipProfileOnboardingField,
} from "@/lib/profile-onboarding-save";
import ProfileOnboardingProgressBar from "./profile-onboarding-progress-bar";

type Step = "intro" | "question" | "done";

type Props = {
  open: boolean;
  initialData: ProfileOnboardingData;
  hasPartner: boolean;
  resume?: boolean;
  onClose: () => void;
};

function getInitialValue(
  key: ProfileOnboardingFieldKey,
  data: ProfileOnboardingData
): string {
  switch (key) {
    case "display_name":
      return data.displayName ?? "";
    case "partner_nickname":
      return data.partnerNickname ?? "";
    case "birth_date":
      return data.birthDate ?? "";
    case "residence":
      return data.residence ?? "";
    case "mbti":
      return data.mbti ?? "";
    case "animal_zodiac":
      return data.animalZodiac ?? "";
    case "basic_values":
      return data.basicValues ?? "";
    case "communication_style":
      return data.communicationStyle ?? "";
    case "comfortable_phrases":
      return data.comfortablePhrases ?? "";
    case "avoid_phrases":
      return data.avoidPhrases ?? "";
    case "notes":
      return data.notes ?? "";
    case "partner_impression":
      return data.partnerImpression ?? "";
    case "anniversary":
      return "";
    default:
      return "";
  }
}

export default function ProfileOnboardingModal({
  open,
  initialData,
  hasPartner,
  resume = false,
  onClose,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [data, setData] = useState(initialData);
  const [currentKey, setCurrentKey] = useState<ProfileOnboardingFieldKey | null>(
    null
  );
  const [value, setValue] = useState("");
  const [anniversaryTitle, setAnniversaryTitle] = useState("");
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionPassed, setSessionPassed] = useState<
    Set<ProfileOnboardingFieldKey>
  >(() => new Set());

  const progress = buildProfileOnboardingProgress(data, hasPartner);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setData(initialData);
    setError(null);
    setSessionPassed(new Set());

    if (
      countProfileOnboardingAnswered(initialData) >= PROFILE_ONBOARDING_TOTAL
    ) {
      setStep("done");
      setCurrentKey(null);
      return;
    }

    const skipIntro =
      resume || !!initialData.completedAt || !!initialData.dismissedAt;

    setCurrentKey(PROFILE_ONBOARDING_FIELD_KEYS[0]);
    setStep(skipIntro ? "question" : "intro");
  }, [open, initialData, resume]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (currentKey) {
      setValue(getInitialValue(currentKey, data));
      setAnniversaryTitle("");
      setAnniversaryDate("");
    }
  }, [currentKey, data]);

  if (!open || !mounted) return null;

  const question = currentKey
    ? getProfileOnboardingQuestion(currentKey)
    : null;
  const previousKey = currentKey ? getPreviousWizardField(currentKey) : null;

  async function handleDismiss() {
    await dismissProfileOnboarding();
    setData((prev) => ({ ...prev, dismissedAt: new Date().toISOString() }));
    onClose();
    router.refresh();
  }

  async function handleStart() {
    const next = getNextWizardField(sessionPassed);
    if (!next) {
      await finishWizard();
      return;
    }
    setCurrentKey(next);
    setStep("question");
    setError(null);
  }

  function markSessionPassed(key: ProfileOnboardingFieldKey) {
    setSessionPassed((prev) => new Set(prev).add(key));
  }

  async function finishWizard() {
    const result = await completeProfileOnboarding();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData((prev) => ({
      ...prev,
      completedAt: new Date().toISOString(),
    }));
    setStep("done");
    router.refresh();
  }

  async function advanceAfterField(
    updated: ProfileOnboardingData,
    finishedKey: ProfileOnboardingFieldKey
  ) {
    const passed = new Set(sessionPassed);
    passed.add(finishedKey);
    const wizardNext = getNextWizardField(passed);
    if (!wizardNext) {
      if (countProfileOnboardingAnswered(updated) >= PROFILE_ONBOARDING_TOTAL) {
        setStep("done");
        router.refresh();
      } else {
        await finishWizard();
      }
      return;
    }
    setCurrentKey(wizardNext);
    setValue(getInitialValue(wizardNext, updated));
    setStep("question");
  }

  async function handleNext() {
    if (!currentKey || !question) return;

    let payload = value.trim();

    if (question.inputType === "anniversary") {
      if (!anniversaryTitle.trim() || !anniversaryDate) {
        setError("記念日の名前と日付を入力するか、スキップを選んでください");
        return;
      }
      payload = JSON.stringify({
        title: anniversaryTitle.trim(),
        date: anniversaryDate,
      });
    } else if (!payload) {
      setError("入力するか、スキップを選んでください");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await saveProfileOnboardingAnswer(currentKey, payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const updated = applyAnswer(data, currentKey, payload);
    const answeredKey = currentKey;
    const clearedSkipped = updated.skipped.filter((k) => k !== answeredKey);
    const nextData =
      clearedSkipped.length === updated.skipped.length
        ? updated
        : { ...updated, skipped: clearedSkipped };

    markSessionPassed(answeredKey);
    setData(nextData);
    await advanceAfterField(nextData, answeredKey);
  }

  async function handleSkip() {
    if (!currentKey) return;

    setSaving(true);
    setError(null);
    const skippedKey = currentKey;
    const result = await skipProfileOnboardingField(skippedKey);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const updated = {
      ...data,
      skipped: data.skipped.includes(skippedKey)
        ? data.skipped
        : [...data.skipped, skippedKey],
    };

    markSessionPassed(skippedKey);
    setData(updated);
    await advanceAfterField(updated, skippedKey);
  }

  function handleBack() {
    if (!currentKey || !previousKey) return;

    setSessionPassed((prev) => {
      const next = new Set(prev);
      next.delete(currentKey);
      return next;
    });
    setCurrentKey(previousKey);
    setError(null);
  }

  function handleDoneClose() {
    onClose();
    router.refresh();
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="閉じる"
        className="fixed inset-0 z-[100] bg-black/45"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-onboarding-title"
          className="pointer-events-auto w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border-2 border-violet-100 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
        >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-violet-50 bg-white/95 backdrop-blur-sm px-4 py-3.5 rounded-t-2xl">
          <div className="min-w-0">
            <p
              id="profile-onboarding-title"
              className="text-sm font-black text-gray-800 tracking-tight"
            >
              <span className="text-violet-400">✦</span> AiAiからの質問
            </p>
            {step === "question" && (
              <p className="text-[10px] text-violet-400/70 mt-0.5 font-bold">
                ふたりをもっと理解するための質問
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-5 space-y-5">
          {step === "intro" && (
            <div className="space-y-5 text-center py-2">
              <p className="text-[15px] font-bold text-gray-800 leading-relaxed">
                AiAiがふたりのことを知るために、
                <br />
                いくつか質問してもいいですか？
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                1問ずつ、会話みたいに聞いていくよ。
                <br />
                わからない質問はスキップして大丈夫。
              </p>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  はじめる
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
                >
                  あとで
                </button>
              </div>
            </div>
          )}

          {step === "question" && question && (
            <div className="space-y-4">
              <ProfileOnboardingProgressBar
                progress={progress}
                variant="wizard"
                currentKey={currentKey}
              />

              <div className="rounded-xl bg-violet-50/50 border-2 border-violet-100/80 px-4 py-4">
                <p className="text-[15px] font-bold text-gray-800 leading-snug">
                  {question.prompt}
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {question.hint}
                </p>
                {question.privateNote && (
                  <p className="text-[10px] text-violet-500/80 mt-2 font-medium">
                    🔒 {question.privateNote}
                  </p>
                )}
              </div>

              {question.inputType === "text" && (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={question.placeholder}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-200"
                  autoFocus
                />
              )}

              {question.inputType === "date" && (
                <input
                  type="date"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-200"
                  autoFocus
                />
              )}

              {question.inputType === "textarea" && (
                <textarea
                  rows={3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={question.placeholder}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-200 resize-none"
                  autoFocus
                />
              )}

              {question.inputType === "mbti" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {MBTI_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setValue(option)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-colors ${
                          value === option
                            ? "bg-violet-500 border-violet-500 text-white"
                            : "bg-white border-gray-100 text-gray-600 hover:border-violet-200"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {question.inputType === "anniversary" && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="onboarding-anniversary-title"
                      className="block text-xs font-bold text-gray-500 mb-1.5"
                    >
                      記念日の名前
                    </label>
                    <input
                      id="onboarding-anniversary-title"
                      type="text"
                      value={anniversaryTitle}
                      onChange={(e) => setAnniversaryTitle(e.target.value)}
                      placeholder={question.placeholder}
                      className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-200"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="onboarding-anniversary-date"
                      className="block text-xs font-bold text-gray-500 mb-1.5"
                    >
                      日付
                    </label>
                    <input
                      id="onboarding-anniversary-date"
                      type="date"
                      value={anniversaryDate}
                      onChange={(e) => setAnniversaryDate(e.target.value)}
                      className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-200"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {saving ? "保存中..." : "次へ"}
                </button>
                <div className="flex items-center justify-between gap-3">
                  {previousKey ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={saving}
                      className="text-sm text-gray-500 hover:text-gray-700 py-2 disabled:opacity-50"
                    >
                      ← 前の質問
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={saving}
                    className="text-sm text-gray-400 hover:text-gray-600 py-2 disabled:opacity-50"
                  >
                    スキップ
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-5 text-center py-2">
              <p className="text-3xl" aria-hidden="true">
                🎉
              </p>
              <p className="text-[15px] font-bold text-gray-800 leading-relaxed">
                ありがとう！
                <br />
                これで相談がもっと的確になるよ
              </p>
              <ProfileOnboardingProgressBar progress={progress} />
              <p className="text-xs text-gray-500">
                {countProfileOnboardingAnswered(data) < PROFILE_ONBOARDING_TOTAL
                  ? "未回答の質問は、ホームのカードからいつでも答え直せるよ"
                  : "あとから「ふたり」タブの設定から編集できるよ"}
              </p>
              <button
                type="button"
                onClick={handleDoneClose}
                className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function applyAnswer(
  data: ProfileOnboardingData,
  key: ProfileOnboardingFieldKey,
  value: string
): ProfileOnboardingData {
  const trimmed = value.trim();
  switch (key) {
    case "display_name":
      return { ...data, displayName: trimmed };
    case "partner_nickname":
      return { ...data, partnerNickname: trimmed };
    case "birth_date":
      return { ...data, birthDate: trimmed };
    case "residence":
      return { ...data, residence: trimmed };
    case "mbti":
      return { ...data, mbti: trimmed };
    case "animal_zodiac":
      return { ...data, animalZodiac: trimmed };
    case "basic_values":
      return { ...data, basicValues: trimmed };
    case "communication_style":
      return { ...data, communicationStyle: trimmed };
    case "comfortable_phrases":
      return { ...data, comfortablePhrases: trimmed };
    case "avoid_phrases":
      return { ...data, avoidPhrases: trimmed };
    case "notes":
      return { ...data, notes: trimmed };
    case "partner_impression":
      return { ...data, partnerImpression: trimmed };
    case "anniversary":
      return { ...data, hasAnniversary: true };
    default:
      return data;
  }
}
