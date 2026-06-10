"use client";

import type { ProfileOnboardingProgress } from "@/lib/profile-onboarding-types";
import ProfileOnboardingProgressBar from "./profile-onboarding-progress-bar";

type Props = {
  progress: ProfileOnboardingProgress;
  onContinue: () => void;
};

export default function ProfileOnboardingCoupleBanner({
  progress,
  onContinue,
}: Props) {
  if (progress.isComplete) return null;

  return (
    <button
      type="button"
      onClick={onContinue}
      className="w-full text-left rounded-xl border-2 border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-3.5 hover:border-violet-300/80 transition-colors mb-4"
    >
      <p className="text-[13px] font-black text-gray-800 mb-2">
        プロフィールを完成させる
      </p>
      <ProfileOnboardingProgressBar progress={progress} compact />
      <p className="text-[10px] font-bold text-violet-500 mt-2">
        続きから答える →
      </p>
    </button>
  );
}
