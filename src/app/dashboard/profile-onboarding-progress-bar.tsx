import {
  getWizardQuestionIndex,
  profileOnboardingBarPercent,
  profileOnboardingProgressLabel,
  profileOnboardingWizardBarPercent,
  profileOnboardingWizardProgressLabel,
} from "@/lib/profile-onboarding-state";
import type {
  ProfileOnboardingFieldKey,
  ProfileOnboardingProgress,
} from "@/lib/profile-onboarding-types";

type Props = {
  progress: ProfileOnboardingProgress;
  compact?: boolean;
  variant?: "registration" | "wizard";
  currentKey?: ProfileOnboardingFieldKey;
};

export default function ProfileOnboardingProgressBar({
  progress,
  compact = false,
  variant = "registration",
  currentKey,
}: Props) {
  const isWizard = variant === "wizard" && !!currentKey;
  const { primary, secondary } = isWizard
    ? profileOnboardingWizardProgressLabel(progress, currentKey)
    : profileOnboardingProgressLabel(progress);
  const percent = isWizard
    ? profileOnboardingWizardBarPercent(currentKey)
    : profileOnboardingBarPercent(progress);
  const ariaValueNow = isWizard
    ? getWizardQuestionIndex(currentKey)
    : progress.answeredCount;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div
        className={
          isWizard
            ? "space-y-0.5"
            : "flex items-baseline justify-between gap-2"
        }
      >
        <p
          className={
            compact
              ? "text-[11px] font-bold text-gray-600 tabular-nums"
              : isWizard
                ? "text-sm font-black text-gray-800 tabular-nums"
                : "text-xs font-bold text-gray-700 tabular-nums"
          }
        >
          {primary}
        </p>
        {secondary && (
          <p
            className={
              isWizard
                ? "text-[10px] text-gray-400 font-medium"
                : "text-[10px] text-gray-400 font-medium shrink-0"
            }
          >
            {secondary}
          </p>
        )}
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-violet-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={ariaValueNow}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-label={isWizard ? `質問 ${primary}` : primary}
        />
      </div>
    </div>
  );
}
