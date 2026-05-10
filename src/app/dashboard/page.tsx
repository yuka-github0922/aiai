import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import InviteCodeCopy from "./invite-code-copy";
import PartnerNicknameEditor from "./partner-nickname-editor";
import { generateNudgeWithAI, type InsightRow, type AnniversaryRow, type MemoRow } from "@/lib/nudge";

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

type AiSummaryRow = {
  gender: string | null;
  birth_year: number | null;
  mbti: string | null;
  basic_values: string | null;
  communication_style: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, joined_at, couples(id, invite_code, created_at)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const couple = membership.couples as unknown as CoupleRow | null;

  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id, joined_at")
    .eq("couple_id", membership.couple_id);

  const partner = (members as MemberRow[] | null)?.find(
    (m) => m.user_id !== user.id
  ) ?? null;

  let partnerProfile: ProfileRow | null = null;
  if (partner) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", partner.user_id)
      .maybeSingle();
    partnerProfile = profile;
  }

  const { data: aiSummary } = await supabase
    .from("ai_summaries")
    .select("gender, birth_year, mbti, basic_values, communication_style")
    .eq("user_id", user.id)
    .maybeSingle() as { data: AiSummaryRow | null };

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("partner_nickname")
    .eq("id", user.id)
    .maybeSingle();

  // ナッジ用データ取得
  const [{ data: rawInsights }, { data: rawAnniversaries }, { data: rawMemos }] = await Promise.all([
    supabase.rpc("get_partner_insights_for_nudge", { limit_param: 5 }),
    supabase
      .from("anniversaries")
      .select("title, date")
      .eq("couple_id", membership.couple_id),
    supabase
      .from("partner_memos")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const nudgeMessage = await generateNudgeWithAI(
    (rawInsights ?? []) as InsightRow[],
    (rawAnniversaries ?? []) as AnniversaryRow[],
    (rawMemos ?? []) as MemoRow[]
  );

  const partnerNickname = (myProfile as { partner_nickname: string | null } | null)?.partner_nickname;

  const genderLabel =
    aiSummary?.gender === "male" ? "男性" : aiSummary?.gender === "female" ? "女性" : null;
  const hasSummary = !!(
    aiSummary?.mbti || aiSummary?.communication_style || aiSummary?.basic_values
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400">♥</span>
            <span className="font-bold text-gray-800 text-lg tracking-tight">AiAi</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 flex flex-col gap-3">

        {/* ─── あなた ─── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* ユーザー情報 */}
          <div className="px-6 pt-5 pb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              あなた
            </p>
            <p className="text-sm text-gray-700 font-medium">{user.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              参加日: {new Date(membership.joined_at as string).toLocaleDateString("ja-JP")}
            </p>
          </div>

          {/* 招待コード */}
          {couple && (
            <>
              <div className="h-px bg-gray-50 mx-6" />
              <div className="px-6 py-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                  招待コード
                </p>
                <InviteCodeCopy code={couple.invite_code} />
                {!partner && (
                  <p className="text-xs text-gray-400 mt-2">
                    パートナーにこのコードを共有してください
                  </p>
                )}
              </div>
            </>
          )}

          {/* あなたの情報 */}
          <div className="h-px bg-gray-50 mx-6" />
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                あなたの情報
              </p>
              <Link
                href="/settings"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                編集 →
              </Link>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5">
              入力するほど、AIのアドバイス精度が上がります
            </p>
            {hasSummary ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {aiSummary?.mbti && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {aiSummary.mbti}
                    </span>
                  )}
                  {genderLabel && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {genderLabel}
                    </span>
                  )}
                  {aiSummary?.birth_year && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {aiSummary.birth_year}年生
                    </span>
                  )}
                </div>
                {aiSummary?.communication_style && (
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {aiSummary.communication_style}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                まだ入力されていません。
              </p>
            )}
          </div>
        </section>

        {/* ─── パートナー ─── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            パートナー
          </p>
          {partner ? (
            <PartnerNicknameEditor
              initialNickname={partnerNickname ?? null}
              joinedAt={partner.joined_at}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-lg shrink-0">
                ?
              </div>
              <p className="text-sm text-gray-400">まだパートナーが参加していません</p>
            </div>
          )}
        </section>

        {/* ─── AiAiからのひとこと ─── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-rose-400 text-base">♥</span>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              AiAiからのひとこと
            </p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {nudgeMessage}
          </p>
          <p className="text-[11px] text-gray-400 mt-3">
            パートナーの最近の傾向や記念日をもとに提案しています
          </p>
        </section>

        {/* ─── 相談チャット ─── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
            相談チャット
          </p>
          <p className="text-xs text-gray-400 mb-4">
            AIがふたりのすれ違いをやさしくほどきます
          </p>
          <Link
            href="/consultations"
            className="block w-full text-center bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            相談一覧を見る
          </Link>
        </section>

      </div>
    </main>
  );
}
