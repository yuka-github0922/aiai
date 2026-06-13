import type { BackgroundDirection, SkinFamilyId } from "@/lib/couple-home-world/types";

/** 材質・骨格のみ — UI には ID を出さない */
export function selectSkinFamily(background: BackgroundDirection): SkinFamilyId {
  if (background.depth >= 0.5 && background.lightness < 58) {
    return "neon_arcade";
  }
  if (background.texture >= 0.42) {
    return "cozy_journal";
  }
  if (background.openness >= 0.45 || background.warmth < 0.05) {
    return "ocean_voyage";
  }
  return "soft_default";
}
