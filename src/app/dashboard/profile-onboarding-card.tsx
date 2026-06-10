"use client";

import type { ProfileOnboardingProgress } from "@/lib/profile-onboarding-types";
import ProfileOnboardingProgressBar from "./profile-onboarding-progress-bar";

type Props = {
  progress: ProfileOnboardingProgress;
  onContinue: () => void;
};

export default function ProfileOnboardingCard({ progress, onContinue }: Props) {
  if (progress.isComplete) return null;

  return (
    <button
      type="button"
      onClick={onContinue}
      className="w-full text-left aiai-sticker-card px-4 py-4 border-2 border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/40 to-rose-50/30 hover:border-violet-300/80 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border-2 border-violet-100 text-lg shrink-0"
          aria-hidden="true"
        >
          ✨
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-sm font-black text-gray-800">
              プロフィールを完成させる
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              答えるほど、相談があなたに合った内容になるよ
            </p>
          </div>
          <ProfileOnboardingProgressBar progress={progress} compact />
          <p className="text-[11px] font-bold text-violet-500">
            質問に答える →
          </p>
        </div>
      </div>
    </button>
  );
}
