import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TIMELINE_PAGE_SIZE } from "@/lib/timeline-constants";
import { parseTimelineFilters } from "@/lib/timeline-filters";
import { getTimelinePage } from "@/lib/timeline-page";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") ?? TIMELINE_PAGE_SIZE))
  );
  const filters = parseTimelineFilters(searchParams);

  try {
    const page = await getTimelinePage(offset, limit, filters);
    if (!page) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(page);
  } catch (error) {
    console.error("timeline page error:", error);
    return NextResponse.json(
      { error: "Failed to load timeline" },
      { status: 500 }
    );
  }
}
