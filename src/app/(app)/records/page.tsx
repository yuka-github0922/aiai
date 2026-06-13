import { redirect } from "next/navigation";
import { requireCoupleAppContext } from "@/lib/couple-app-data";
import { buildCoupleStats } from "@/lib/couple-stats";
import { getDailyQuestionRevealCount } from "@/lib/daily-question-stats";
import { getTimelinePage } from "@/lib/timeline-page";
import {
  DEFAULT_TIMELINE_PERIOD_FILTER,
  DEFAULT_TIMELINE_SOURCE_FILTER,
} from "@/lib/timeline-filters";
import AppHeader from "@/components/app/app-header";
import RecordsStatsSection from "@/app/dashboard/records-stats-section";
import RecentRecordsSection from "@/app/dashboard/recent-records-section";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";

export default async function RecordsPage() {
  const [ctx, timelinePage] = await Promise.all([
    requireCoupleAppContext(),
    getTimelinePage(0, undefined, {
      source: DEFAULT_TIMELINE_SOURCE_FILTER,
      period: DEFAULT_TIMELINE_PERIOD_FILTER,
    }),
  ]);

  if (!timelinePage) redirect("/login");

  const [coupleStats, dailyQuestionCount] = await Promise.all([
    Promise.resolve(buildCoupleStats(ctx.anniversaries)),
    getDailyQuestionRevealCount(ctx.membership.couple_id),
  ]);

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader title="きろく" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <RecordsStatsSection
          memoCount={ctx.memoCount}
          consultationCount={ctx.consultationCount}
          dailyQuestionCount={dailyQuestionCount}
          anniversaryCount={ctx.anniversaries.length}
          stats={coupleStats}
        />

        <RecentRecordsSection
          initialRecords={timelinePage.records}
          initialHasMore={timelinePage.hasMore}
          initialTotal={timelinePage.total}
          initialFilters={timelinePage.filters}
        />
      </div>
    </main>
  );
}
