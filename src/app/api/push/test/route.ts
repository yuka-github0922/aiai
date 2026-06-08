import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[push] /api/push/test: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.info("[push] /api/push/test: start", { userId: user.id });

  const result = await sendPushToUser(supabase, user.id, {
    title: "AiAiから今日のひとこと",
    body: "今日のふたり質問に答えてみませんか？",
    url: "/home",
  });

  const responseBody = {
    ok: !result.error,
    sent: result.sent,
    failed: result.failed,
    removed: result.removed,
    subscriptionCount: result.subscriptionCount,
    failures: result.failures,
    error: result.error,
  };

  if (result.error) {
    console.error("[push] /api/push/test: failed", responseBody);
    return NextResponse.json(responseBody, {
      status: result.subscriptionCount === 0 ? 400 : 502,
    });
  }

  console.info("[push] /api/push/test: success", responseBody);
  return NextResponse.json(responseBody);
}
