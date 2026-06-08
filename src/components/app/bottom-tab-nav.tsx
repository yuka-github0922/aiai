"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "ホーム", icon: "🏠" },
  { href: "/records", label: "きろく", icon: "📖" },
  { href: "/consultations", label: "相談", icon: "💬" },
  { href: "/couple", label: "ふたり", icon: "♡" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t-2 border-white shadow-[0_-4px_16px_rgba(148,163,184,0.12)]"
      aria-label="メインナビゲーション"
    >
      <div className="max-w-lg mx-auto px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-4 gap-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-colors ${
                    active
                      ? "text-rose-500"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`text-lg leading-none ${active ? "scale-110" : ""} transition-transform`}
                    aria-hidden="true"
                  >
                    {tab.icon}
                  </span>
                  <span
                    className={`text-[10px] font-bold tracking-wide ${
                      active ? "text-rose-500" : ""
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
