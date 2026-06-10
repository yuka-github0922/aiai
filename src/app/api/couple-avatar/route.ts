import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCachedCoupleTraits } from "@/lib/fetch-cached-couple-traits";

function findAvatarUrl(
  selfTraits: { user_id: string; avatar_url?: string | null },
  partnerTraits: { user_id: string; avatar_url?: string | null } | null,
  userId: string
): string | null {
  if (selfTraits.user_id === userId) {
    return selfTraits.avatar_url ?? null;
  }
  if (partnerTraits?.user_id === userId) {
    return partnerTraits.avatar_url ?? null;
  }
  return null;
}

function dataUrlToResponse(dataUrl: string): NextResponse | null {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;

  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.couple_id) {
    return NextResponse.json({ error: "couple not found" }, { status: 404 });
  }

  const cached = await fetchCachedCoupleTraits(supabase, membership.couple_id);
  if (!cached) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const avatarUrl = findAvatarUrl(
    cached.self_traits,
    cached.partner_traits,
    userId
  );

  if (!avatarUrl) {
    return NextResponse.json({ error: "avatar not found" }, { status: 404 });
  }

  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return NextResponse.redirect(avatarUrl, 302);
  }

  const imageResponse = dataUrlToResponse(avatarUrl);
  if (imageResponse) {
    return imageResponse;
  }

  return NextResponse.json({ error: "invalid avatar" }, { status: 500 });
}
