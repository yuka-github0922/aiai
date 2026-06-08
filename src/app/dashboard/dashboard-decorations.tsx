/** 余白デコ — 背景はそのまま、恋愛感はハートを少し足す */
export default function DashboardDecorations() {
  return (
    <div className="pointer-events-none fixed inset-0 max-w-lg mx-auto overflow-hidden z-0" aria-hidden="true">
      <span className="absolute top-32 left-4 text-rose-200/50 text-xs">♥</span>
      <span className="absolute top-44 right-5 w-2 h-2 bg-sky-300/50 rotate-45 rounded-sm" />
      <span className="absolute top-[45%] left-2 text-rose-200/40 text-[10px]">♡</span>
      <span className="absolute top-[58%] right-4 text-amber-300/40 text-xs">✦</span>
      <span className="absolute bottom-44 left-6 text-rose-200/35 text-sm">♥</span>
      <span className="absolute bottom-56 right-7 w-2 h-2 bg-violet-200/50 rounded-full" />
    </div>
  );
}
