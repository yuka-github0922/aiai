import { NextResponse } from "next/server";
import { runCoupleHomeWorldGeneration } from "@/lib/couple-home-world/ensure-couple-home-world";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership?.couple_id) {
    return NextResponse.json({ error: "couple not found" }, { status: 404 });
  }

  const coupleId = membership.couple_id as string;

  const { data: members } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const partnerId = memberIds.find((id) => id !== user.id);

  if (!partnerId) {
    return NextResponse.json({ error: "partner required" }, { status: 400 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds);

  const selfProfile = profiles?.find((p) => p.id === user.id);
  const partnerProfile = profiles?.find((p) => p.id === partnerId);

  const selfName =
    selfProfile?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "あなた";
  const partnerName = partnerProfile?.display_name?.trim() || "パートナー";

  const result = await runCoupleHomeWorldGeneration(
    supabase,
    coupleId,
    { self: selfName, partner: partnerName },
    { forceRetry: true }
  );

  return NextResponse.json(result);
}
