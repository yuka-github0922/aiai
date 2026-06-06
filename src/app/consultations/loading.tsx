import { ListItemSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function ConsultationsLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28 rounded-lg bg-rose-100/80" />
        </div>

        <ul className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </ul>

        <div className="mt-6">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </main>
  );
}
