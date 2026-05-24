function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className ?? ""}`} />;
}

function CardSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400">♥</span>
            <span className="font-bold text-gray-800 text-lg tracking-tight">AiAi</span>
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-3">
        {/* あなた */}
        <CardSkeleton>
          <div className="px-6 pt-5 pb-4">
            <Skeleton className="h-3 w-12 mb-3" />
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="h-px bg-gray-50 mx-6" />
          <div className="px-6 py-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="h-px bg-gray-50 mx-6" />
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-full mb-2" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </CardSkeleton>

        {/* パートナー */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <Skeleton className="h-3 w-16 mb-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardSkeleton>

        {/* AiAiからのひとこと */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-rose-400 text-base">♥</span>
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-[80%] mb-2" />
            <Skeleton className="h-4 w-[60%] mb-4" />
            <Skeleton className="h-3 w-56" />
          </div>
        </CardSkeleton>

        {/* 相談チャット */}
        <CardSkeleton>
          <div className="px-6 py-5">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-3 w-full mb-4" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </CardSkeleton>
      </div>
    </main>
  );
}
