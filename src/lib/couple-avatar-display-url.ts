import type { CachedCoupleTraitMember } from "@/lib/couple-traits-types";

/** 巨大 data URL を RSC/HTML に埋め込まず、短い URL で表示する */
export function getCoupleAvatarDisplayUrl(
  member: CachedCoupleTraitMember
): string | null {
  const url = member.avatar_url;
  if (!url || url.length === 0) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("data:image/")) {
    return `/api/couple-avatar?userId=${encodeURIComponent(member.user_id)}`;
  }

  return null;
}
