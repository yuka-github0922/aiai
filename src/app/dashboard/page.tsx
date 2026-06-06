import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildAiMemories, countAiMemories, type MemoForMemory } from "@/lib/ai-memories";
import { interpretMemosForDisplay } from "@/lib/interpret-memos-for-display";
import { buildCoupleStats } from "@/lib/couple-stats";
import { generateNudgeWithAI, type InsightRow, type AnniversaryRow, type MemoRow } from "@/lib/nudge";
import { decryptHintBody } from "@/lib/encryption";
import ConsultCta from "./consult-cta";
import DashboardHero from "./dashboard-hero";
import NudgeCard from "./nudge-card";
import AiMemoriesSection from "./ai-memories-section";
import DashboardDecorations from "./dashboard-decorations";
import SettingsPanel from "./settings-panel";

type CoupleRow = {
  id: string;
  invite_code: string;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  joined_at: string;
};

type AiSummaryRow = {
  gender: string | null;
  birth_year: number | null;
  mbti: string | null;
  basic_values: string | null;
  communication_style: string | null;
};

function resolveSelfName(
  displayName: string | null | undefined,
  email: string | undefined
): string {
  if (displayName?.trim()) return displayName.trim();
  const local = email?.split("@")[0];
  return local?.trim() || "あなた";
}

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

  const [
    { data: aiSummary },
    { data: myProfile },
    { data: rawInsights },
    { data: rawAnniversaries },
    { data: rawMemos },
    { count: memoCount },
  ] = await Promise.all([
    supabase
      .from("ai_summaries")
      .select("gender, birth_year, mbti, basic_values, communication_style")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("partner_nickname, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("get_partner_insights_for_nudge", { limit_param: 100 }),
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
    supabase
      .from("partner_memos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  type RawInsightRow = {
    partner_hint_encrypted: string | null;
    partner_hint_iv:        string | null;
    partner_hint_auth_tag:  string | null;
    created_at:             string;
  };
  const decryptedInsights: InsightRow[] = (rawInsights ?? []).map((r: RawInsightRow) => ({
    partner_hint: decryptHintBody(r),
    created_at:   r.created_at,
  }));

  const anniversaries = (rawAnniversaries ?? []) as AnniversaryRow[];
  const memos = (rawMemos ?? []) as MemoForMemory[];

  const [nudgeMessage, interpretedMemoLabels] = await Promise.all([
    generateNudgeWithAI(decryptedInsights, anniversaries, memos),
    interpretMemosForDisplay(memos),
  ]);

  const validInsights = decryptedInsights.filter(
    (i) => i.partner_hint.trim().length > 0
  );

  const aiMemories = buildAiMemories({
    memos: memos.map((memo) => ({
      ...memo,
      displayLabel: interpretedMemoLabels.get(memo.id ?? memo.created_at),
    })),
    insights: validInsights,
  });

  const totalMemoryCount = countAiMemories(memoCount ?? 0, validInsights.length);

  const coupleStats = buildCoupleStats(anniversaries);

  const profile = myProfile as {
    partner_nickname: string | null;
    display_name: string | null;
  } | null;

  const partnerNickname = profile?.partner_nickname;
  const selfName = resolveSelfName(profile?.display_name, user.email);
  const partnerName = partnerNickname?.trim() || "パートナー";

  const genderLabel =
    aiSummary?.gender === "male" ? "男性" : aiSummary?.gender === "female" ? "女性" : null;

  const summaryTags = [
    aiSummary?.mbti,
    genderLabel,
    aiSummary?.birth_year ? `${aiSummary.birth_year}年生` : null,
  ].filter((tag): tag is string => !!tag);

  return (
    <main className="min-h-screen aiai-dashboard-bg relative">
      <DashboardDecorations />

      <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md border-b-2 border-white shadow-[0_2px_0_rgba(148,163,184,0.12)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400 text-sm">♥</span>
            <span className="text-lg font-black italic text-rose-500 tracking-tight">
              AiAi
            </span>
            <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded tracking-wider">
              ふたり専用
            </span>
          </div>
          <Link
            href="/settings"
            className="text-[11px] font-bold text-gray-500 bg-white px-3 py-1.5 rounded-lg border-2 border-gray-100 shadow-[2px_2px_0_rgba(148,163,184,0.15)] hover:text-gray-700 transition-colors"
          >
            設定
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex flex-col gap-3.5">
        <DashboardHero
          selfName={selfName}
          partnerName={partnerName}
          hasPartner={!!partner}
          stats={coupleStats}
          inviteCode={couple?.invite_code ?? null}
        />

        <NudgeCard message={nudgeMessage} />

        <AiMemoriesSection memories={aiMemories} totalCount={totalMemoryCount} />

        <ConsultCta />

        <SettingsPanel
          email={user.email ?? ""}
          joinedAt={membership.joined_at as string}
          inviteCode={couple?.invite_code ?? null}
          hasPartner={!!partner}
          partnerNickname={partnerNickname ?? null}
          partnerJoinedAt={partner?.joined_at ?? null}
          summaryTags={summaryTags}
          communicationStyle={aiSummary?.communication_style ?? null}
          defaultOpen={!partner}
        />
      </div>
    </main>
  );
}
