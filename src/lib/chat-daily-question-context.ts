import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDailyQuestionRoundDetail,
  type DailyQuestionRoundDetail,
  type DailyQuestionRoundDetailRpc,
} from "@/lib/daily-question-types";

const DEFAULT_LIMIT = 5;

export async function fetchRecentDailyQuestionsForChat(
  supabase: SupabaseClient,
  limit = DEFAULT_LIMIT
): Promise<DailyQuestionRoundDetail[]> {
  const { data, error } = await supabase.rpc(
    "get_recent_daily_question_rounds_for_chat",
    { p_limit: limit }
  );

  if (error) {
    console.error(
      "[chat-daily-question-context] get_recent_daily_question_rounds_for_chat error:",
      error
    );
    return [];
  }

  if (!data) return [];

  if (!Array.isArray(data)) {
    const record = data as DailyQuestionRoundDetailRpc & { error?: string };
    if (record.error) {
      console.error(
        "[chat-daily-question-context] RPC error:",
        record.error
      );
    }
    return [];
  }

  return (data as DailyQuestionRoundDetailRpc[])
    .map((item) => parseDailyQuestionRoundDetail(item))
    .filter((item): item is DailyQuestionRoundDetail => item !== null);
}
