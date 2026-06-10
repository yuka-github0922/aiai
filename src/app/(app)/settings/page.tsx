import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/dashboard/logout-button";
import AiSummaryForm from "./ai-summary-form";
import AnniversarySection from "./anniversary-section";

export type AiSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
  gender: string | null;
  birth_year: number | null;
  birth_date: string | null;
  mbti: string | null;
  basic_values: string | null;
  animal_zodiac: string | null;
  residence: string | null;
  partner_impression: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: summary }, { data: profile }, { data: anniversaries }] =
    await Promise.all([
      supabase
        .from("ai_summaries")
        .select(
          "communication_style, comfortable_phrases, avoid_phrases, notes, gender, birth_year, birth_date, mbti, basic_values, animal_zodiac, residence, partner_impression"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("partner_nickname, display_name")
        .eq("id", user.id)
        .maybeSingle(),
      membership
        ? supabase
            .from("anniversaries")
            .select("id, title, date")
            .eq("couple_id", membership.couple_id)
            .order("date", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <main className="min-h-screen aiai-dashboard-bg">
      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/couple"
            className="text-gray-400 hover:text-rose-500 text-lg font-bold"
            aria-label="ふたりに戻る"
          >
            ←
          </Link>
          <h1 className="text-base font-black text-gray-800">設定</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
          あなたのプロフィールとコミュニケーション傾向をAIに伝えることで、
          パートナーへのアドバイスがより的確になります。
        </p>

        <section className="aiai-sticker-card px-4 py-5 mb-3.5">
          <h2 className="text-sm font-black text-gray-800 mb-1">
            AI プロフィール設定
          </h2>
          <p className="text-[10px] text-gray-400 mb-5">
            パートナーが相談するとき、AIがあなたのことをより深く理解するために使います。
          </p>

          <AiSummaryForm
            initialSummary={summary as AiSummaryRow | null}
            initialDisplayName={
              (profile as { display_name: string | null } | null)?.display_name ??
              ""
            }
            initialPartnerNickname={
              (profile as { partner_nickname: string | null } | null)
                ?.partner_nickname ?? ""
            }
          />
        </section>

        <section id="anniversaries" className="aiai-sticker-card px-4 py-5 scroll-mt-4">
          <h2 className="text-sm font-black text-gray-800 mb-1">記念日</h2>
          <p className="text-[10px] text-gray-400 mb-5">
            登録した記念日はナッジ（AiAiからのひとこと）に活用されます。
          </p>
          <AnniversarySection
            initialAnniversaries={
              (anniversaries ?? []) as {
                id: string;
                title: string;
                date: string;
              }[]
            }
          />
        </section>

        <div className="mt-8 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
