import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/push/cron-auth";
import { sendDailyQuestionNotifications } from "@/lib/push/daily-question-notify";

/** Vercel Cron は GET。手動テストは POST も可。スケジュール: 毎日 20:00 JST（11:00 UTC） */
async function handleDailyQuestionPush(request: Request) {
  const auth = verifyCronSecret(request);
  if (!auth.ok) {
    console.error("[push] /api/push/daily-question: auth failed", auth.error);
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  console.info("[push] /api/push/daily-question: start", {
    auth: auth.method,
  });

  try {
    const result = await sendDailyQuestionNotifications();

    const responseBody = {
      ok: result.ok,
      targets: result.targets,
      notified: result.notified,
      failed: result.failed,
      subscriptionsRemoved: result.subscriptionsRemoved,
      errors: result.errors,
      error: result.error,
    };

    if (result.error) {
      console.error("[push] /api/push/daily-question: failed", responseBody);
      return NextResponse.json(responseBody, { status: 503 });
    }

    console.info("[push] /api/push/daily-question: done", responseBody);
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[push] /api/push/daily-question: unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to send daily question notifications" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleDailyQuestionPush(request);
}

export async function POST(request: Request) {
  return handleDailyQuestionPush(request);
}
