import { requireCoupleAppContext } from "@/lib/couple-app-data";
import { resolveCouplePortrait } from "@/lib/resolve-couple-portrait";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileOnboardingData } from "@/lib/profile-onboarding-data";
import AppHeader from "@/components/app/app-header";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";
import {
  CoupleTraitsSection,
  AiRecentNoticesSection,
  CoupleSettingsSection,
} from "./couple-portrait-sections";
import ProfileOnboardingCoupleSection from "./profile-onboarding-couple-section";

export default async function CouplePage() {
  const ctx = await requireCoupleAppContext();
  const hasPartner = !!ctx.partner;
  const onboardingData = await fetchProfileOnboardingData(
    ctx.user.id,
    ctx.membership.couple_id
  );

  const supabase = await createClient();
  const portrait = await resolveCouplePortrait(
    supabase,
    ctx.membership.couple_id,
    {
      selfName: ctx.selfName,
      partnerName: ctx.partnerName,
      hasPartner,
      mbti: ctx.mbti,
      communicationStyle: ctx.communicationStyle,
    }
  );

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader title="ふたり" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <p className="text-[10px] text-center text-rose-400/70 tracking-wide -mb-1 leading-relaxed">
          AiAiがつくった紹介文と似顔絵で、ふたりで笑い合おう
        </p>

        <CoupleTraitsSection portrait={portrait} />

        <AiRecentNoticesSection portrait={portrait} />

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
