import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPushSubscriptionsForUser } from "@/lib/push/subscription";
import { isVapidConfigured } from "@/lib/push/send";
import { getVapidPublicKey } from "@/lib/push/vapid";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subscriptions, listError } = await listPushSubscriptionsForUser(
    supabase,
    user.id
  );

  return NextResponse.json({
    dbSubscriptionCount: subscriptions.length,
    listError,
    vapidPublicKeySet: !!getVapidPublicKey(),
    vapidConfigured: isVapidConfigured(),
  });
}
