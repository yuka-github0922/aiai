import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { isVapidConfigured } from "@/lib/push/send";
import { sendPushToUserWithServiceRole } from "@/lib/push/send-cron";

const NOTIFICATION_TYPE = "daily_question";

const DAILY_QUESTION_PUSH_PAYLOAD = {
  title: "ふたり質問",
  body: "ふたりの質問に答えて、相手の気持ちを少しのぞいてみませんか？",
  url: "/home",
} as const;

export type DailyQuestionNotifyError = {
  userId: string;
  roundId: string;
  message: string;
};

export type DailyQuestionNotifyResult = {
  ok: boolean;
  targets: number;
  notified: number;
  failed: number;
  subscriptionsRemoved: number;
  errors: DailyQuestionNotifyError[];
  error: string | null;
};

type PushTargetRow = {
  user_id: string;
  round_id: string;
};

export async function sendDailyQuestionNotifications(): Promise<DailyQuestionNotifyResult> {
  if (!isVapidConfigured()) {
    return {
      ok: false,
      targets: 0,
      notified: 0,
      failed: 0,
      subscriptionsRemoved: 0,
      errors: [],
      error:
        "VAPID 鍵が未設定です。.env.local に NEXT_PUBLIC_VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY を設定してください",
    };
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("list_daily_question_push_targets");

  if (error) {
    console.error("[push] list_daily_question_push_targets error:", error);
    return {
      ok: false,
      targets: 0,
      notified: 0,
      failed: 0,
      subscriptionsRemoved: 0,
      errors: [],
      error: `送信対象の取得に失敗しました（${error.code ?? "unknown"}）`,
    };
  }

  const targets = (data ?? []) as PushTargetRow[];
  let notified = 0;
  let failed = 0;
  let subscriptionsRemoved = 0;
  const errors: DailyQuestionNotifyError[] = [];

  for (const target of targets) {
    const { user_id: userId, round_id: roundId } = target;

    const result = await sendPushToUserWithServiceRole(
      supabase,
      userId,
      DAILY_QUESTION_PUSH_PAYLOAD
    );

    subscriptionsRemoved += result.removed;

    if (result.sent > 0) {
      const { error: insertError } = await supabase
        .from("daily_question_notifications")
        .insert({
          user_id: userId,
          round_id: roundId,
          notification_type: NOTIFICATION_TYPE,
        });

      if (insertError) {
        console.error("[push] daily_question_notifications insert error:", {
          userId,
          roundId,
          code: insertError.code,
          message: insertError.message,
        });
      }

      notified++;
      console.info("[push] daily-question notified:", {
        userId,
        roundId,
        sent: result.sent,
        failed: result.failed,
        removed: result.removed,
      });
      continue;
    }

    failed++;
    const message = result.error ?? "通知の送信に失敗しました";
    errors.push({ userId, roundId, message });
    console.error("[push] daily-question notify failed:", {
      userId,
      roundId,
      sent: result.sent,
      failed: result.failed,
      removed: result.removed,
      failures: result.failures,
      message,
    });
  }

  return {
    ok: notified > 0 || (targets.length > 0 && failed === 0),
    targets: targets.length,
    notified,
    failed,
    subscriptionsRemoved,
    errors,
    error: null,
  };
}
