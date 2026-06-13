import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureCasualConsultation } from "@/lib/ensure-casual-consultation";
import AppHeader from "@/components/app/app-header";
import DashboardDecorations from "@/app/dashboard/dashboard-decorations";

type ConsultationRow = {
  id: string;
  title: string;
  kind: string;
  created_at: string;
  updated_at: string;
};

function sortConsultations(rows: ConsultationRow[]): ConsultationRow[] {
  return [...rows].sort((a, b) => {
    if (a.kind === "casual" && b.kind !== "casual") return -1;
    if (b.kind === "casual" && a.kind !== "casual") return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export default async function ConsultationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await ensureCasualConsultation(supabase);

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("id, title, kind, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("consultations fetch error:", error);
  }

  const sorted = sortConsultations((consultations ?? []) as ConsultationRow[]);
  const hasOnlyCasual =
    sorted.length === 1 && sorted[0]?.kind === "casual";

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />
      <AppHeader title="相談" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 pb-24">
        <p className="text-[10px] text-rose-400/70 text-center mb-4 tracking-wide">
          相談が終わると、きろくに残るよ
        </p>

        {sorted.length === 0 ? (
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
            {sorted.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/consultations/${c.id}`}
                  className={`aiai-sticker-card block px-4 py-4 hover:scale-[1.01] transition-transform active:scale-[0.99] ${
                    c.kind === "casual" ? "border-rose-100/90" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {c.kind === "casual" ? (
                      <span className="text-base leading-none mt-0.5" aria-hidden="true">
                        ☕
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate text-[15px]">
                        {c.title}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {c.kind === "casual"
                          ? "日常の雑談 · "
                          : null}
                        {new Date(c.updated_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hasOnlyCasual ? (
          <p className="text-[10px] text-center text-gray-400 mt-4 tracking-wide">
            相談したいことがあれば、下の＋から新しいスレッドを作れるよ
          </p>
        ) : null}

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
