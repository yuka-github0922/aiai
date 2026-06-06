type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-gradient-to-r from-gray-100 via-rose-50/60 to-gray-100 rounded animate-pulse ${className}`}
    />
  );
}

export function CardSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

export function CardDivider() {
  return <div className="h-px bg-gray-50 mx-6" />;
}

export function SectionLabelSkeleton({ width = "w-16" }: { width?: string }) {
  return <Skeleton className={`h-3 ${width}`} />;
}

export function AiAiBrand() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-rose-400">♥</span>
      <span className="font-bold text-gray-800 text-lg tracking-tight">AiAi</span>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <li className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-3 w-36" />
    </li>
  );
}

export function BubbleSkeleton({
  align,
  lines = 1,
}: {
  align: "left" | "right";
  lines?: 1 | 2;
}) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && (
        <span className="text-xs text-rose-300 self-end mr-1 mb-1">AI</span>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 space-y-1.5 ${
          align === "right"
            ? "rounded-br-sm bg-rose-100/80"
            : "rounded-bl-sm bg-gray-100"
        }`}
      >
        <Skeleton
          className={`h-3.5 ${align === "right" ? "bg-rose-200/70" : ""} ${
            align === "right" ? "w-40" : "w-52"
          }`}
        />
        {lines === 2 && (
          <Skeleton
            className={`h-3.5 ${align === "right" ? "bg-rose-200/60 w-28" : "w-36"}`}
          />
        )}
      </div>
    </div>
  );
}

export function TypingIndicator({ label = "AiAiが考え中..." }: { label?: string }) {
  return (
    <div className="flex justify-start items-end gap-1">
      <span className="text-xs text-rose-300 self-end mb-1">AI</span>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2.5">
        <div className="flex gap-1 items-center">
          <span className="w-2 h-2 bg-rose-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-rose-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" />
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    </div>
  );
}
