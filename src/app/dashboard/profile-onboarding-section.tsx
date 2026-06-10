"use client";

import { useEffect, useState } from "react";
import { buildProfileOnboardingProgress } from "@/lib/profile-onboarding-state";
import type { ProfileOnboardingData } from "@/lib/profile-onboarding-types";
import ProfileOnboardingCard from "./profile-onboarding-card";
import ProfileOnboardingModal from "./profile-onboarding-modal";

type Props = {
  initialData: ProfileOnboardingData;
  hasPartner: boolean;
};

export default function ProfileOnboardingSection({
  initialData,
  hasPartner,
}: Props) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [resume, setResume] = useState(false);
  const [closedThisVisit, setClosedThisVisit] = useState(false);

  const progress = buildProfileOnboardingProgress(data, hasPartner);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!progress.shouldAutoOpen) {
      setOpen(false);
      return;
    }
    if (closedThisVisit) return;

    const hasStarted =
      !!data.completedAt ||
      progress.answeredCount > 0 ||
      progress.skippedCount > 0;
    setResume(hasStarted);
    setOpen(true);
  }, [progress.shouldAutoOpen, closedThisVisit, data.completedAt, progress.answeredCount, progress.skippedCount]);

  if (progress.isComplete) return null;

  return (
    <>
      {progress.shouldShowCard && (
        <ProfileOnboardingCard
          progress={progress}
          onContinue={() => {
            setResume(true);
            setOpen(true);
          }}
        />
      )}

      <ProfileOnboardingModal
        open={open}
        initialData={data}
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
