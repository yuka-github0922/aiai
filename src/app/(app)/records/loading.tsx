import { Skeleton } from "@/components/ui/skeleton";

export default function RecordsLoading() {
  return (
    <main className="min-h-screen aiai-dashboard-bg">
      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Skeleton className="h-5 w-16" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <section className="aiai-sticker-card px-4 py-5">
          <Skeleton className="h-4 w-28 mb-4" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </section>

        <section className="aiai-sticker-card px-4 py-5">
          <Skeleton className="h-4 w-28 mb-4" />
          <div className="space-y-4 ml-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </section>
      </div>
    </main>
  );
}
