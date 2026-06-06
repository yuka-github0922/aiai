import {
  AiAiBrand,
  CardDivider,
  CardSkeleton,
  SectionLabelSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <AiAiBrand />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-3">
        {/* あなた */}
        <CardSkeleton>
          <div className="px-6 pt-5 pb-4">
            <SectionLabelSkeleton width="w-12" />
            <Skeleton className="h-4 w-48 mt-3 mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>

          <CardDivider />

          <div className="px-6 py-4">
            <SectionLabelSkeleton width="w-20" />
            <Skeleton className="h-10 w-full rounded-xl mt-3" />
            <Skeleton className="h-3 w-52 mt-2" />
          </div>

          <CardDivider />

          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-1">
              <SectionLabelSkeleton width="w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-full mb-3" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full mt-3" />
            <Skeleton className="h-3 w-4/5 mt-1.5" />
          </div>
        </CardSkeleton>

        {/* パートナー */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <SectionLabelSkeleton width="w-16" />
            <div className="flex items-center gap-3 mt-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </CardSkeleton>

        {/* AiAiからのひとこと */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-rose-400 text-base">♥</span>
              <SectionLabelSkeleton width="w-28" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-[90%] mb-2" />
            <Skeleton className="h-4 w-[70%] mb-4" />
            <Skeleton className="h-3 w-56" />
          </div>
        </CardSkeleton>

        {/* 相談チャット */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <SectionLabelSkeleton width="w-20" />
            <Skeleton className="h-3 w-full mt-2 mb-4" />
            <Skeleton className="h-10 w-full rounded-xl bg-rose-100/80" />
          </div>
        </CardSkeleton>
      </div>
    </main>
  );
}
