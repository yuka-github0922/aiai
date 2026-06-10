"use client";

import { useEffect, useState } from "react";
import { buildProfileOnboardingProgress } from "@/lib/profile-onboarding-state";
import type { ProfileOnboardingData } from "@/lib/profile-onboarding-types";
import ProfileOnboardingCoupleBanner from "@/app/dashboard/profile-onboarding-couple-banner";
import ProfileOnboardingModal from "@/app/dashboard/profile-onboarding-modal";

type Props = {
  initialData: ProfileOnboardingData;
  hasPartner: boolean;
};

export default function ProfileOnboardingCoupleSection({
  initialData,
  hasPartner,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState(false);
  const [closedThisVisit, setClosedThisVisit] = useState(false);
  const progress = buildProfileOnboardingProgress(initialData, hasPartner);

  useEffect(() => {
    if (!progress.shouldAutoOpen) {
      setOpen(false);
      return;
    }
    if (closedThisVisit) return;

    const hasStarted =
      !!initialData.completedAt ||
      progress.answeredCount > 0 ||
      progress.skippedCount > 0;
    setResume(hasStarted);
    setOpen(true);
  }, [
    progress.shouldAutoOpen,
    closedThisVisit,
    initialData.completedAt,
    progress.answeredCount,
    progress.skippedCount,
  ]);

  if (progress.isComplete) return null;

  return (
    <>
      <ProfileOnboardingCoupleBanner
        progress={progress}
        onContinue={() => {
          setResume(true);
          setOpen(true);
        }}
      />
      <ProfileOnboardingModal
        open={open}
        initialData={initialData}
        hasPartner={hasPartner}
        resume={resume}
        onClose={() => {
          setOpen(false);
          setResume(false);
          setClosedThisVisit(true);
        }}
      />
    </>
  );
}
