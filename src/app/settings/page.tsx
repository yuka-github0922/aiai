import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiSummaryForm from "./ai-summary-form";

type AiSummaryRow = {
  communication_style: string | null;
  comfortable_phrases: string | null;
  avoid_phrases: string | null;
  notes: string | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 自分の ai_summary だけ読む（RLS: user_id = auth.uid()）
  const { data: summary } = await supabase
    .from("ai_summaries")
    .select("communication_style, comfortable_phrases, avoid_phrases, notes")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">設定</h1>
        <p className="text-sm text-gray-500 mb-8">
          あなたのコミュニケーション傾向をAIに伝えることで、
          パートナーへのアドバイスがより的確になります。
          この情報はパートナーには直接表示されません。
        </p>

        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-1">
            AI 要約メモ
          </h2>
          <p className="text-xs text-gray-400 mb-6">
            パートナーが相談するとき、AIがあなたのことをより深く理解するために使います。
          </p>

          <AiSummaryForm initialSummary={summary as AiSummaryRow | null} />
        </section>
      </div>
    </main>
  );
}
