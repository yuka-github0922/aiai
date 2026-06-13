import { requireCoupleAppContext } from "@/lib/couple-app-data";
import {
  fetchCoupleHomeWorldDisplay,
  fetchCoupleHomeWorldRow,
} from "@/lib/couple-home-world/fetch-couple-home-world";
import { isCoupleWorldActive } from "@/lib/couple-home-world/resolve-couple-world-display";
import { resolveCouplePortrait } from "@/lib/resolve-couple-portrait";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileOnboardingData } from "@/lib/profile-onboarding-data";
import AppHeader from "@/components/app/app-header";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";
import HomeWorldGenerationTrigger from "@/app/dashboard/home-world-generation-trigger";
import {
  CoupleTraitsSection,
  AiRecentNoticesSection,
  CoupleSettingsSection,
} from "./couple-portrait-sections";
import ProfileOnboardingCoupleSection from "./profile-onboarding-couple-section";

export default async function CouplePage() {
  const ctx = await requireCoupleAppContext();
  const hasPartner = !!ctx.partner;
  const coupleId = ctx.membership.couple_id as string;
  const onboardingData = await fetchProfileOnboardingData(
    ctx.user.id,
    coupleId
  );

  const supabase = await createClient();
  const [portrait, homeWorld, homeWorldRow] = await Promise.all([
    resolveCouplePortrait(supabase, coupleId, {
      selfName: ctx.selfName,
      partnerName: ctx.partnerName,
      hasPartner,
      mbti: ctx.mbti,
      communicationStyle: ctx.communicationStyle,
    }),
    fetchCoupleHomeWorldDisplay(supabase, coupleId),
    fetchCoupleHomeWorldRow(supabase, coupleId),
  ]);

  const worldActive =
    hasPartner && isCoupleWorldActive(homeWorld.revealedCount, homeWorldRow);

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader title="ふたり" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        {worldActive ? (
          <HomeWorldGenerationTrigger
            active={
              homeWorld.sceneState === "establishing" ||
              homeWorld.shouldRegrow === true
            }
          />
        ) : (
          <p className="text-[10px] text-center text-rose-400/70 tracking-wide -mb-1 leading-relaxed">
            AiAiがつくった紹介文と似顔絵で、ふたりで笑い合おう
          </p>
        )}

        <CoupleTraitsSection portrait={portrait} />
        <AiRecentNoticesSection
          notices={portrait.recentNotices}
          hasPartner={hasPartner}
        />

        <CoupleSettingsSection
          inviteCode={ctx.couple?.invite_code ?? null}
          hasPartner={hasPartner}
          onboardingSlot={
            <ProfileOnboardingCoupleSection
              initialData={onboardingData}
              hasPartner={hasPartner}
            />
          }
        />
      </div>
    </main>
  );
}
