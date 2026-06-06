import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen aiai-dashboard-bg">
      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <section className="aiai-sticker-card overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <Skeleton className="h-10 w-full" />
        </section>

        <section className="aiai-sticker-card px-4 py-5">
          <Skeleton className="h-4 w-36 mb-4" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </section>

        <section className="aiai-sticker-card px-4 py-5">
          <div className="flex justify-between mb-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-8 rounded" />
          </div>
          <div className="space-y-2.5">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </section>

        <Skeleton className="h-[72px] w-full rounded-2xl" />
        <Skeleton className="h-4 w-36 mx-auto" />
      </div>
    </main>
  );
}
