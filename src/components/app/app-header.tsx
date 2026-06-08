import Link from "next/link";
import NotificationBell from "@/components/app/notification-bell";

type Props = {
  title?: string;
  action?: { href: string; label: string };
};

export default function AppHeader({ title, action }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white shadow-[0_2px_0_rgba(148,163,184,0.12)]">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-rose-400 text-sm shrink-0">♥</span>
          {title ? (
            <span className="text-base font-black text-gray-800 tracking-tight truncate">
              {title}
            </span>
          ) : (
            <>
              <span className="text-lg font-black italic text-rose-500 tracking-tight">
                AiAi
              </span>
              <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded tracking-wider shrink-0">
                ふたり専用
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <Link
              href={action.href}
              className="text-[11px] font-bold text-gray-500 bg-white px-3 py-1.5 rounded-lg border-2 border-gray-100 shadow-[2px_2px_0_rgba(148,163,184,0.15)] hover:text-gray-700 transition-colors"
            >
              {action.label}
            </Link>
          )}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
