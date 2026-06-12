import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecentDailyQuestionsForChat } from "@/lib/chat-daily-question-context";
import { fetchRevealedDailyQuestionCount } from "@/lib/couple-home-world/fetch-couple-home-world";
import type {
  HomeWorldGenerationInput,
  HomeWorldQuestionRound,
  HomeWorldRegrowthInput,
  WorldBible,
} from "@/lib/couple-home-world/types";
import {
  HOME_WORLD_INPUT_LIMIT,
  HOME_WORLD_REGROWTH_CONTEXT_LIMIT,
} from "@/lib/couple-home-world/types";

function mapRounds(
  rounds: Awaited<ReturnType<typeof fetchRecentDailyQuestionsForChat>>,
  names: { self: string; partner: string }
): HomeWorldQuestionRound[] {
  return rounds.map((round) => ({
    roundId: round.roundId,
    question: round.question,
    answers: [
      { name: names.self, answer: round.myAnswer },
      { name: names.partner, answer: round.partnerAnswer },
    ],
  }));
}

export async function fetchHomeWorldGenerationInput(
  supabase: SupabaseClient,
  names: { self: string; partner: string }
): Promise<HomeWorldGenerationInput | null> {
  const [revealedCount, rounds] = await Promise.all([
    fetchRevealedDailyQuestionCount(supabase),
    fetchRecentDailyQuestionsForChat(supabase, HOME_WORLD_INPUT_LIMIT),
  ]);

  if (rounds.length === 0) {
    return null;
  }

  return {
    revealedCount,
    rounds: mapRounds(rounds, names),
  };
}

export async function fetchHomeWorldRegrowthInput(
  supabase: SupabaseClient,
  names: { self: string; partner: string },
  previousWorldBible: WorldBible,
  previousSourceRoundIds: string[]
): Promise<HomeWorldRegrowthInput | null> {
  const [revealedCount, rounds] = await Promise.all([
    fetchRevealedDailyQuestionCount(supabase),
    fetchRecentDailyQuestionsForChat(supabase, HOME_WORLD_REGROWTH_CONTEXT_LIMIT),
  ]);

  if (rounds.length === 0) {
    return null;
  }

  const mapped = mapRounds(rounds, names);
  const previousIdSet = new Set(previousSourceRoundIds);
  const newRounds = mapped.filter((round) => !previousIdSet.has(round.roundId));

  if (newRounds.length === 0) {
    return null;
  }

  return {
    revealedCount,
    previousWorldBible,
    previousSourceRoundIds,
    newRounds,
    recentRounds: mapped,
  };
}

export function collectUpdatedSourceRoundIds(
  previousSourceRoundIds: string[],
  newRounds: HomeWorldQuestionRound[]
): string[] {
  const ids = new Set(previousSourceRoundIds);
  for (const round of newRounds) {
    ids.add(round.roundId);
  }
  return [...ids];
}
