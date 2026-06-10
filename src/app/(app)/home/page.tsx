import {
  requireCoupleAppContext,
  memosWithLabels,
} from "@/lib/couple-app-data";
import { buildAiMemoriesLatest } from "@/lib/ai-memories";
import { buildCoupleStats } from "@/lib/couple-stats";
import { fetchProfileOnboardingData } from "@/lib/profile-onboarding-data";
import { buildProfileOnboardingProgress } from "@/lib/profile-onboarding-state";
import AppHeader from "@/components/app/app-header";
import ConsultCta from "@/app/dashboard/consult-cta";
import DashboardHero from "@/app/dashboard/dashboard-hero";
import NudgeCard from "@/app/dashboard/nudge-card";
import AiMemoriesSection from "@/app/dashboard/ai-memories-section";
import DailyQuestionSection from "@/app/dashboard/daily-question-section";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";
import ProfileOnboardingSection from "@/app/dashboard/profile-onboarding-section";

export default async function HomePage() {
  const ctx = await requireCoupleAppContext();
  const hasPartner = !!ctx.partner;
  const onboardingData = await fetchProfileOnboardingData(
    ctx.user.id,
    ctx.membership.couple_id
  );
  if (process.env.NODE_ENV === "development") {
    const onboardingProgress = buildProfileOnboardingProgress(
      onboardingData,
      hasPartner
    );
    console.log("[profile-onboarding] home state:", {
      hasPartner,
      completedAt: onboardingData.completedAt,
      dismissedAt: onboardingData.dismissedAt,
      ...onboardingProgress,
    });
  }
  const labeledMemos = memosWithLabels(ctx.memos, ctx.interpretedMemoLabels);

  const aiMemories = buildAiMemoriesLatest(
    { memos: labeledMemos, insights: [] },
    5
  );

  const coupleStats = buildCoupleStats(ctx.anniversaries);

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <DashboardHero
          selfName={ctx.selfName}
          partnerName={ctx.partnerName}
          hasPartner={hasPartner}
          stats={coupleStats}
          inviteCode={ctx.couple?.invite_code ?? null}
        />

        <ProfileOnboardingSection
          initialData={onboardingData}
          hasPartner={hasPartner}
        />

        <NudgeCard message={ctx.nudgeMessage} />

        <AiMemoriesSection memories={aiMemories} />

        <DailyQuestionSection />

        <ConsultCta />
      </div>
    </main>
  );
}
