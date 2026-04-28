import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ConsultationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: consultations, error } = await supabase
    .from("consultations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("consultations fetch error:", error);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">相談一覧</h1>
          <Link
            href="/consultations/new"
            className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ＋ 新しい相談
          </Link>
        </div>

        {!consultations || consultations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">まだ相談がありません</p>
            <Link
              href="/consultations/new"
              className="text-rose-500 hover:text-rose-600 text-sm font-medium underline"
            >
              最初の相談を作成する
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {consultations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/consultations/${c.id}`}
                  className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-rose-300 hover:shadow-sm transition-all"
                >
                  <p className="font-medium text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(c.updated_at).toLocaleString("ja-JP")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
