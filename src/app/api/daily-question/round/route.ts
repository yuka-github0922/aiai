import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDailyQuestionRoundDetail } from "@/lib/daily-question-round-detail";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = new URL(request.url).searchParams.get("roundId")?.trim();
  if (!roundId) {
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }

  const detail = await fetchDailyQuestionRoundDetail(roundId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
