import { createClient } from "@/lib/supabase/server";
import {
  parseDailyQuestionState,
  type DailyQuestionRpcState,
  type DailyQuestionState,
} from "@/lib/daily-question-types";

export {
  DAILY_QUESTION_MAX_LENGTH,
  parseDailyQuestionState,
  type DailyQuestionPhase,
  type DailyQuestionHidden,
  type DailyQuestionVisible,
  type DailyQuestionState,
} from "@/lib/daily-question-types";

export async function fetchDailyQuestionState(): Promise<DailyQuestionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_question_state");

  if (error) {
    console.error("get_daily_question_state error:", error);
    return { visible: false };
  }

  return parseDailyQuestionState(data as DailyQuestionRpcState | null);
}
