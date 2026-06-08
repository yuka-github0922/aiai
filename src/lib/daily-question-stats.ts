import { createClient } from "@/lib/supabase/server";

export async function getDailyQuestionRevealCount(
  coupleId: string
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("daily_question_rounds")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", coupleId)
    .not("revealed_at", "is", null);

  if (error) {
    console.error("daily_question_rounds count error:", error);
    return 0;
  }

  return count ?? 0;
}
