import { ListItemSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ConsultationsLoading() {
  return (
    <main className="min-h-screen aiai-dashboard-bg">
      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Skeleton className="h-5 w-12" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-3">
        <ul className="space-y-2.5">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </ul>
      </div>
    </main>
  );
}
