function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className ?? ""}`} />;
}

function BubbleSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && <Skeleton className="h-3 w-4 self-end mr-1 mb-1 rounded" />}
      <Skeleton
        className={`max-w-[75%] rounded-2xl ${
          align === "right"
            ? "rounded-br-sm h-10 w-48 bg-rose-100"
            : "rounded-bl-sm h-16 w-56"
        }`}
      />
    </div>
  );
}

export default function ConsultationChatLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 flex-1 max-w-xs" />
      </header>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <BubbleSkeleton align="right" />
          <BubbleSkeleton align="left" />
          <BubbleSkeleton align="right" />
          <BubbleSkeleton align="left" />
          <BubbleSkeleton align="right" />
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2 bg-white items-end">
          <Skeleton className="flex-1 h-10 rounded-2xl" />
          <Skeleton className="h-10 w-16 rounded-full shrink-0" />
        </div>
      </div>
    </main>
  );
}
