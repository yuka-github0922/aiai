import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecentDailyQuestionsForChat } from "@/lib/chat-daily-question-context";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import { resolvePartnerHint } from "@/lib/encryption";
import {
  COUPLE_TRAITS_PROMPT_VERSION,
  COUPLE_OBSERVATIONS_PROMPT_VERSION,
  type CoupleTraitsGenerationContext,
  type CoupleTraitsInsightMember,
  type CoupleTraitsMemoMember,
  type CoupleTraitsProfileMember,
} from "@/lib/couple-traits-types";

function resolveDisplayName(
  displayName: string | null | undefined,
  fallback: string
): string {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function parseProfileMembers(raw: unknown): CoupleTraitsProfileMember[] {
  if (!Array.isArray(raw)) return [];
  return raw as CoupleTraitsProfileMember[];
}

function parseInsightMembers(raw: unknown): CoupleTraitsInsightMember[] {
  if (!Array.isArray(raw)) return [];
  return raw as CoupleTraitsInsightMember[];
}

function parseMemoMembers(raw: unknown): CoupleTraitsMemoMember[] {
  if (!Array.isArray(raw)) return [];
  return raw as CoupleTraitsMemoMember[];
}

export async function fetchCoupleTraitsGenerationContext(
  supabase: SupabaseClient,
  viewerUserId: string
): Promise<CoupleTraitsGenerationContext> {
  const [profilesResult, insightsResult, memosResult, dailyQuestionRounds] =
    await Promise.all([
      supabase.rpc("get_couple_profiles_for_traits"),
      supabase.rpc("get_couple_insights_for_traits", { p_limit_per_member: 15 }),
      supabase.rpc("get_couple_memos_for_traits", { p_limit_per_member: 10 }),
      fetchRecentDailyQuestionsForChat(supabase, 5),
    ]);

  if (profilesResult.error) {
    console.error(
      formatSupabaseError(
        profilesResult.error,
        "[couple-traits-context] get_couple_profiles_for_traits"
      )
    );
  }
  if (insightsResult.error) {
    console.error(
      formatSupabaseError(
        insightsResult.error,
        "[couple-traits-context] get_couple_insights_for_traits"
      )
    );
  }
  if (memosResult.error) {
    console.error(
      formatSupabaseError(
        memosResult.error,
        "[couple-traits-context] get_couple_memos_for_traits"
      )
    );
  }

  const profileMembers = parseProfileMembers(profilesResult.data);
  const insightMembers = parseInsightMembers(insightsResult.data);
  const memoMembers = parseMemoMembers(memosResult.data);

  const insightMap = new Map(
    insightMembers.map((member) => [
      member.user_id,
      (member.insights ?? [])
        .map((row) => resolvePartnerHint(row))
        .filter((hint) => hint.trim().length > 0),
    ])
  );

  const memoMap = new Map(
    memoMembers.map((member) => [
      member.user_id,
      (member.memos ?? [])
        .map((row) => row.content?.trim() ?? "")
        .filter((content) => content.length > 0),
    ])
  );

  const members = profileMembers.map((member, index) => {
    const otherMember = profileMembers.find((m) => m.user_id !== member.user_id);
    return {
      userId: member.user_id,
      name: resolveDisplayName(member.display_name, `メンバー${index + 1}`),
      profile: {
        gender: member.gender,
        basicValues: member.basic_values,
        communicationStyle: member.communication_style,
        partnerImpressionAboutOther: otherMember
          ? member.partner_impression
          : null,
      },
      insights: insightMap.get(member.user_id) ?? [],
      memos: memoMap.get(member.user_id) ?? [],
    };
  });

  const firstMember = members[0] ?? null;
  const secondMember = members[1] ?? null;
  const viewerIsFirstMember = firstMember?.userId === viewerUserId;

  const dailyQuestions = dailyQuestionRounds.map((round) => {
    if (!firstMember) {
      return {
        question: round.question,
        answers: [],
        understandingCoupleScore: round.understanding?.coupleScore ?? null,
      };
    }

    if (!secondMember) {
      return {
        question: round.question,
        answers: [
          {
            userId: firstMember.userId,
            name: firstMember.name,
            answer: round.myAnswer,
            guess: round.myGuess,
          },
        ],
        understandingCoupleScore: round.understanding?.coupleScore ?? null,
      };
    }

    return {
      question: round.question,
      answers: [
        {
          userId: firstMember.userId,
          name: firstMember.name,
          answer: viewerIsFirstMember ? round.myAnswer : round.partnerAnswer,
          guess: viewerIsFirstMember ? round.myGuess : round.partnerGuess,
        },
        {
          userId: secondMember.userId,
          name: secondMember.name,
          answer: viewerIsFirstMember ? round.partnerAnswer : round.myAnswer,
          guess: viewerIsFirstMember ? round.partnerGuess : round.myGuess,
        },
      ],
      understandingCoupleScore: round.understanding?.coupleScore ?? null,
    };
  });

  return { members, dailyQuestions };
}

export function buildCoupleTraitsSourceSummary(
  context: CoupleTraitsGenerationContext
): Record<string, unknown> {
  return {
    prompt_version: COUPLE_TRAITS_PROMPT_VERSION,
    member_count: context.members.length,
    insight_counts: context.members.map((member) => ({
      user_id: member.userId,
      count: member.insights.length,
    })),
    memo_counts: context.members.map((member) => ({
      user_id: member.userId,
      count: member.memos.length,
    })),
    daily_question_count: context.dailyQuestions.length,
  };
}

export function buildCoupleObservationsSourceSummary(
  context: CoupleTraitsGenerationContext
): Record<string, unknown> {
  return {
    observations_prompt_version: COUPLE_OBSERVATIONS_PROMPT_VERSION,
    member_count: context.members.length,
    insight_counts: context.members.map((member) => ({
      user_id: member.userId,
      count: member.insights.length,
    })),
    memo_counts: context.members.map((member) => ({
      user_id: member.userId,
      count: member.memos.length,
    })),
    daily_question_count: context.dailyQuestions.length,
  };
}
