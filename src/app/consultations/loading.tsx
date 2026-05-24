function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className ?? ""}`} />;
}

function ListItemSkeleton() {
  return (
    <li className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-3 w-36" />
    </li>
  );
}

export default function ConsultationsLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <ul className="space-y-3">
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
