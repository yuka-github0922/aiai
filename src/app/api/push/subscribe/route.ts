import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parsePushSubscriptionBody,
  upsertPushSubscription,
} from "@/lib/push/subscription";
import { isVapidConfigured } from "@/lib/push/send";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[push] /api/push/subscribe: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVapidConfigured()) {
    console.error("[push] /api/push/subscribe: VAPID keys missing");
    return NextResponse.json(
      {
        error:
          "VAPID 鍵が未設定です。.env.local に NEXT_PUBLIC_VAPID_PUBLIC_KEY と VAPID_PRIVATE_KEY を設定してください",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[push] /api/push/subscribe: invalid JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parsePushSubscriptionBody(body);
  if (!input) {
    console.error("[push] /api/push/subscribe: invalid body", body);
    return NextResponse.json(
      { error: "endpoint, p256dh, auth が必要です" },
      { status: 400 }
    );
  }

  const { error } = await upsertPushSubscription(supabase, user.id, input);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  console.info("[push] /api/push/subscribe: success", {
    userId: user.id,
    endpoint: input.endpoint.slice(0, 48) + "…",
  });

  return NextResponse.json({ ok: true });
}
