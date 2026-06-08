import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deliverPushToUserSubscriptions,
  type PushPayload,
  type PushSendResult,
} from "@/lib/push/send";
import type { PushSubscriptionRow } from "@/lib/push/subscription";

async function listPushSubscriptionsWithServiceRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ subscriptions: PushSubscriptionRow[]; listError: string | null }> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] push_subscriptions list (service role) error:", {
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === "42P01") {
      return {
        subscriptions: [],
        listError:
          "push_subscriptions テーブルがありません。Supabase に migration を適用してください",
      };
    }

    return {
      subscriptions: [],
      listError: `subscription の取得に失敗しました（${error.code ?? "unknown"}）`,
    };
  }

  return { subscriptions: (data ?? []) as PushSubscriptionRow[], listError: null };
}

/** cron 専用: service role client で subscription 取得・送信・410/404 削除 */
export async function sendPushToUserWithServiceRole(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  const { subscriptions, listError } = await listPushSubscriptionsWithServiceRole(
    supabase,
    userId
  );

  if (listError) {
    return {
      sent: 0,
      failed: 0,
      removed: 0,
      subscriptionCount: 0,
      failures: [],
      error: listError,
    };
  }

  return deliverPushToUserSubscriptions(
    supabase,
    userId,
    subscriptions,
    payload
  );
}
