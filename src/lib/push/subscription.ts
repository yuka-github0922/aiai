import type { SupabaseClient } from "@supabase/supabase-js";

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function parsePushSubscriptionBody(
  body: unknown
): PushSubscriptionInput | null {
  if (!body || typeof body !== "object") return null;

  const { endpoint, p256dh, auth } = body as Record<string, unknown>;
  if (
    typeof endpoint !== "string" ||
    !endpoint.trim() ||
    typeof p256dh !== "string" ||
    !p256dh.trim() ||
    typeof auth !== "string" ||
    !auth.trim()
  ) {
    return null;
  }

  return {
    endpoint: endpoint.trim(),
    p256dh: p256dh.trim(),
    auth: auth.trim(),
  };
}

export async function upsertPushSubscription(
  supabase: SupabaseClient,
  userId: string,
  input: PushSubscriptionInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] push_subscriptions upsert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === "42P01") {
      return {
        error:
          "push_subscriptions テーブルがありません。Supabase に migration を適用してください",
      };
    }

    return {
      error: `subscription の保存に失敗しました（${error.code ?? "unknown"}）`,
    };
  }

  console.info("[push] subscription saved:", {
    userId,
    endpoint: input.endpoint.slice(0, 48) + "…",
  });

  return { error: null };
}

export async function listPushSubscriptionsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ subscriptions: PushSubscriptionRow[]; listError: string | null }> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] push_subscriptions list error:", {
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

export async function deletePushSubscriptionByEndpoint(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string
): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push] push_subscriptions delete error:", error);
  }
}
