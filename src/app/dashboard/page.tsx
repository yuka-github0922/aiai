import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import InviteCodeCopy from "./invite-code-copy";

type CoupleRow = {
  id: string;
  invite_code: string;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  joined_at: string;
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 自分の membership と couple を取得
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, joined_at, couples(id, invite_code, created_at)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const couple = membership.couples as unknown as CoupleRow | null;

  // 同じカップルの全メンバーを取得
  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id, joined_at")
    .eq("couple_id", membership.couple_id);

  const partner = (members as MemberRow[] | null)?.find(
    (m) => m.user_id !== user.id
  ) ?? null;

  // パートナーの profile を取得（RLS でパートナーのプロフィールは読める）
  let partnerProfile: ProfileRow | null = null;
  if (partner) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", partner.user_id)
      .maybeSingle();
    partnerProfile = profile;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-4">
        {/* 自分 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            あなた
          </p>
          <p className="text-sm text-gray-700">
            メール:{" "}
            <span className="font-medium text-gray-900">{user.email}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            参加日:{" "}
            {new Date(membership.joined_at as string).toLocaleDateString(
              "ja-JP"
            )}
          </p>
        </section>

        {/* パートナー */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            パートナー
          </p>
          {partner ? (
            <>
              <p className="text-sm text-gray-700">
                表示名:{" "}
                <span className="font-medium text-gray-900">
                  {partnerProfile?.display_name ?? "未設定"}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                参加日:{" "}
                {new Date(partner.joined_at).toLocaleDateString("ja-JP")}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              まだパートナーが参加していません。招待コードを共有してください。
            </p>
          )}
        </section>

        {/* 招待コード */}
        {couple && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              招待コード
            </p>
            <InviteCodeCopy code={couple.invite_code} />
            <p className="text-xs text-gray-400 mt-2">
              パートナーにこのコードを共有してください
            </p>
          </section>
        )}

        {/* 相談チャット */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            相談チャット
          </p>
          <Link
            href="/consultations"
            className="inline-block bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            相談一覧を見る
          </Link>
        </section>

        {/* 設定 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            AI 要約メモ
          </p>
          <p className="text-xs text-gray-400 mb-3">
            あなたのコミュニケーション傾向をAIに伝えて、パートナーへのアドバイスを改善します
          </p>
          <Link
            href="/settings"
            className="inline-block border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            要約メモを編集
          </Link>
        </section>
      </div>
    </main>
  );
}
