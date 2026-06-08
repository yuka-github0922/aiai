import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUser,
  type PushSubscriptionRow,
} from "@/lib/push/subscription";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
} from "@/lib/push/vapid";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export type PushSendFailure = {
  endpoint: string;
  statusCode?: number;
  message: string;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  removed: number;
  subscriptionCount: number;
  failures: PushSendFailure[];
  error: string | null;
};

let vapidConfigured = false;

export function isVapidConfigured(): boolean {
  return !!(getVapidPublicKey() && getVapidPrivateKey());
}

function ensureVapidConfigured(): boolean {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) {
    return false;
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}

function isExpiredSubscriptionError(statusCode: number | undefined): boolean {
  return statusCode === 410 || statusCode === 404;
}

function truncateEndpoint(endpoint: string): string {
  return endpoint.length > 48 ? `${endpoint.slice(0, 48)}…` : endpoint;
}

function toWebPushSubscription(row: PushSubscriptionRow): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function extractWebPushError(err: unknown): PushSendFailure {
  if (err && typeof err === "object") {
    const wp = err as {
      statusCode?: number;
      body?: string;
      message?: string;
      endpoint?: string;
    };
    return {
      endpoint: truncateEndpoint(wp.endpoint ?? "unknown"),
      statusCode: wp.statusCode,
      message: wp.body || wp.message || String(err),
    };
  }
  return {
    endpoint: "unknown",
    message: String(err),
  };
}

export async function deliverPushToUserSubscriptions(
  supabase: SupabaseClient,
  userId: string,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
): Promise<PushSendResult> {
  if (!ensureVapidConfigured()) {
    return {
      sent: 0,
      failed: 0,
      removed: 0,
      subscriptionCount: subscriptions.length,
      failures: [],
      error:
        "VAPID 鍵が未設定です。.env.local に NEXT_PUBLIC_VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY を設定してください",
    };
  }

  if (subscriptions.length === 0) {
    return {
      sent: 0,
      failed: 0,
      removed: 0,
      subscriptionCount: 0,
      failures: [],
      error: "通知登録がまだありません。もう一度「通知をオンにする」を試してください",
    };
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/home",
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const failures: PushSendFailure[] = [];

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(toWebPushSubscription(row), message);
      sent++;
      console.info("[push] sent:", truncateEndpoint(row.endpoint));
    } catch (err) {
      failed++;
      const failure = extractWebPushError(err);
      failure.endpoint = truncateEndpoint(row.endpoint);
      failures.push(failure);

      const statusCode = failure.statusCode;
      if (isExpiredSubscriptionError(statusCode)) {
        await deletePushSubscriptionByEndpoint(supabase, userId, row.endpoint);
        removed++;
      }

      console.error("[push] send failed:", {
        endpoint: failure.endpoint,
        statusCode: failure.statusCode,
        message: failure.message,
      });
    }
  }

  if (sent === 0 && failed > 0) {
    const first = failures[0];
    return {
      sent,
      failed,
      removed,
      subscriptionCount: subscriptions.length,
      failures,
      error: `通知の送信に失敗しました（${first.statusCode ?? "error"}: ${first.message}）`,
    };
  }

  return {
    sent,
    failed,
    removed,
    subscriptionCount: subscriptions.length,
    failures,
    error: null,
  };
}

export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  const { subscriptions, listError } = await listPushSubscriptionsForUser(
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
