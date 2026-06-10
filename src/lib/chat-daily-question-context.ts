import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/fetch-cached-couple-traits";
import {
  parseDailyQuestionRoundDetail,
  type DailyQuestionRoundDetail,
  type DailyQuestionRoundDetailRpc,
} from "@/lib/daily-question-types";

const DEFAULT_LIMIT = 5;

function isMissingRpcError(error: PostgrestError): boolean {
  return (
    error.code === "PGRST202" ||
    error.message?.includes("get_recent_daily_question_rounds_for_chat") ||
    error.message?.includes("Could not find the function")
  );
}

export async function fetchRecentDailyQuestionsForChat(
  supabase: SupabaseClient,
  limit = DEFAULT_LIMIT
): Promise<DailyQuestionRoundDetail[]> {
  const { data, error } = await supabase.rpc(
    "get_recent_daily_question_rounds_for_chat",
    { p_limit: limit }
  );

  if (error) {
    if (isMissingRpcError(error)) {
      console.warn(
        "[chat-daily-question-context] RPC not found — apply migration 20260522150000_get_recent_daily_question_rounds_for_chat.sql"
      );
    } else {
      console.error(
        formatSupabaseError(
          error,
          "[chat-daily-question-context] get_recent_daily_question_rounds_for_chat"
        )
      );
    }
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
