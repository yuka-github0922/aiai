import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/app/app-header";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";

export default async function ConsultationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("consultations fetch error:", error);
  }

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader title="相談" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 pb-24">
        <p className="text-[10px] text-rose-400/70 text-center mb-4 tracking-wide">
          相談が終わると、きろくに残るよ
        </p>

        {!consultations || consultations.length === 0 ? (
          <section className="aiai-sticker-card px-5 py-12 text-center">
            <p className="text-gray-500 text-sm mb-4 leading-relaxed">
              まだ相談がありません
            </p>
            <Link
              href="/consultations/new"
              className="text-sm font-bold text-rose-500 hover:text-rose-600"
            >
              最初の相談をはじめる →
            </Link>
          </section>
        ) : (
          <ul className="space-y-2.5">
            {consultations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/consultations/${c.id}`}
                  className="aiai-sticker-card block px-4 py-4 hover:scale-[1.01] transition-transform active:scale-[0.99]"
                >
                  <p className="font-bold text-gray-800 truncate text-[15px]">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {new Date(c.updated_at).toLocaleString("ja-JP")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/consultations/new"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-rose-500 text-white text-2xl font-light shadow-[3px_3px_0_rgba(244,114,182,0.35)] hover:scale-105 active:scale-95 transition-transform"
          aria-label="新しい相談を作成"
        >
          ＋
        </Link>
      </div>
    </main>
  );
}
