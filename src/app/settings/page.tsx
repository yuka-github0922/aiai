import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiSummaryForm from "./ai-summary-form";
import AnniversarySection from "./anniversary-section";

export type AiSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases:       string | null;
  notes:               string | null;
  gender:              string | null;
  birth_year:          number | null;
  mbti:                string | null;
  basic_values:        string | null;
  animal_zodiac:       string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // カップル所属確認（記念日取得に couple_id が必要）
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ data: summary }, { data: profile }, { data: anniversaries }] = await Promise.all([
    supabase
      .from("ai_summaries")
      .select("communication_style, comfortable_phrases, avoid_phrases, notes, gender, birth_year, mbti, basic_values, animal_zodiac")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("partner_nickname")
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">設定</h1>
        <p className="text-sm text-gray-500 mb-8">
          あなたのプロフィールとコミュニケーション傾向をAIに伝えることで、
          パートナーへのアドバイスがより的確になります。
          この情報はパートナーには直接表示されません。
        </p>

        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-1">
            AI プロフィール設定
          </h2>
          <p className="text-xs text-gray-400 mb-6">
            パートナーが相談するとき、AIがあなたのことをより深く理解するために使います。
          </p>

          <AiSummaryForm
            initialSummary={summary as AiSummaryRow | null}
            initialPartnerNickname={(profile as { partner_nickname: string | null } | null)?.partner_nickname ?? ""}
          />
        </section>

        {/* 記念日 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
          <h2 className="text-base font-semibold text-gray-700 mb-1">記念日</h2>
          <p className="text-xs text-gray-400 mb-5">
            登録した記念日はナッジ（AiAiからのひとこと）に活用されます。
          </p>
          <AnniversarySection
            initialAnniversaries={(anniversaries ?? []) as { id: string; title: string; date: string }[]}
          />
        </section>
      </div>
    </main>
  );
}
