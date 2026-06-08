"use client";

import { usePathname } from "next/navigation";
import BottomTabNav from "./bottom-tab-nav";

function shouldHideTabBar(pathname: string): boolean {
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/consultations/")) return true;
  return false;
}

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const hideTabs = shouldHideTabBar(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className={
          hideTabs
            ? "flex-1"
            : "flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))]"
        }
      >
        {children}
      </div>
      {!hideTabs && <BottomTabNav />}
    </div>
  );
}
