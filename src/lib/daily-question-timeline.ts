import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineEventForRecord } from "@/lib/recent-records";

function parseQuestionFromBody(body: string | null | undefined): string | null {
  if (!body) return null;
  const lines = body.split("\n");
  if (lines[0] !== "質問：") return null;
  return lines[1]?.trim() || null;
}

function parseQuestionFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const prefix = "💖 ふたり質問：";
  if (title.startsWith(prefix)) {
    return title.slice(prefix.length).trim() || null;
  }
  const answeredMatch = title.match(/に「(.+?)」に答えました$/);
  return answeredMatch?.[1]?.trim() ?? null;
}

function resolveQuestion(
  body: string | null | undefined,
  title: string | null | undefined,
  fallback = "ふたり質問"
): string {
  return (
    parseQuestionFromBody(body) ??
    parseQuestionFromTitle(title) ??
    fallback
  );
}

async function fetchFromTimelineEvents(
  supabase: SupabaseClient,
  coupleId: string
): Promise<TimelineEventForRecord[] | null> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("id, title, body, occurred_at, source_ref")
    .eq("couple_id", coupleId)
    .eq("source_type", "daily_question_round")
    .order("occurred_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return null;
    }
    console.error("timeline_events fetch error:", error);
    return null;
  }

  return (data ?? []).map((event) => ({
    id: event.id as string,
    occurred_at: event.occurred_at as string,
    source_ref: event.source_ref as string,
    question: resolveQuestion(
      event.body as string | null,
      event.title as string | null
    ),
  }));
}

async function fetchFromRevealedRounds(
  supabase: SupabaseClient,
  coupleId: string
): Promise<TimelineEventForRecord[]> {
  const { data: rounds, error: roundsError } = await supabase
    .from("daily_question_rounds")
    .select("id, revealed_at, question_id")
    .eq("couple_id", coupleId)
    .not("revealed_at", "is", null)
    .order("revealed_at", { ascending: false });

  if (roundsError) {
    console.error("daily_question_rounds timeline fallback error:", roundsError);
    return [];
  }

  if (!rounds?.length) return [];

  const questionIds = [
    ...new Set(rounds.map((round) => round.question_id as string)),
  ];

  const { data: questions, error: questionsError } = await supabase
    .from("couple_questions")
    .select("id, body")
    .in("id", questionIds);

  if (questionsError) {
    console.error("couple_questions timeline fallback error:", questionsError);
    return [];
  }

  const questionMap = new Map(
    (questions ?? []).map((q) => [q.id as string, q.body as string])
  );

  return rounds.map((round) => {
    const question =
      questionMap.get(round.question_id as string) ?? "ふたり質問";
    return {
      id: round.id as string,
      occurred_at: round.revealed_at as string,
      source_ref: round.id as string,
      question,
    };
  });
}

export async function fetchDailyQuestionTimelineEvents(
  supabase: SupabaseClient,
  coupleId: string
): Promise<TimelineEventForRecord[]> {
  const fromEvents = await fetchFromTimelineEvents(supabase, coupleId);
  if (fromEvents && fromEvents.length > 0) {
    return fromEvents;
  }

  return fetchFromRevealedRounds(supabase, coupleId);
}
