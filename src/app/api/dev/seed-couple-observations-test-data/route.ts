import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("seed_couple_observations_test_data");

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        hint: "Supabase SQL Editor で scripts/seed-couple-observations-test-data.sql を実行するか、node scripts/run-seed-couple-observations-test.mjs を使ってください",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}
