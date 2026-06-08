import { attachUnderstandingToRoundDetail } from "@/lib/daily-question-score-service";
import { createClient } from "@/lib/supabase/server";
import {
  parseDailyQuestionRoundDetail,
  type DailyQuestionRoundDetail,
  type DailyQuestionRoundDetailRpc,
} from "@/lib/daily-question-types";

export async function fetchDailyQuestionRoundDetail(
  roundId: string
): Promise<DailyQuestionRoundDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_question_round_detail", {
    p_round_id: roundId,
  });

  if (error) {
    console.error("get_daily_question_round_detail error:", error);
    return null;
  }

  const detail = parseDailyQuestionRoundDetail(
    data as DailyQuestionRoundDetailRpc | null
  );
  if (!detail) return null;
  return attachUnderstandingToRoundDetail(detail);
}
