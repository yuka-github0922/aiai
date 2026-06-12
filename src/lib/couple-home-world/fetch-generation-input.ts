import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecentDailyQuestionsForChat } from "@/lib/chat-daily-question-context";
import {
  fetchRevealedDailyQuestionCount,
} from "@/lib/couple-home-world/fetch-couple-home-world";
import type { HomeWorldGenerationInput } from "@/lib/couple-home-world/types";
import { HOME_WORLD_INPUT_LIMIT } from "@/lib/couple-home-world/types";

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
    rounds: rounds.map((round) => ({
      roundId: round.roundId,
      question: round.question,
      answers: [
        { name: names.self, answer: round.myAnswer },
        { name: names.partner, answer: round.partnerAnswer },
      ],
    })),
  };
}
