import type { BackgroundDirection, TraitRowStyleId } from "@/lib/couple-home-world/types";

/**
 * traits の質感 — phrase/hero/vars の補助（~20%）。
 * 差は控えめ（gap / padding / vars の微調整のみ）。
 */
export function selectTraitRowStyle(background: BackgroundDirection): TraitRowStyleId {
  if (background.texture >= 0.4 && background.warmth >= 0.2) {
    return "journal";
  }
  if (background.openness >= 0.55) {
    return "airy";
  }
  if (background.depth >= 0.45) {
    return "compact";
  }
  return "soft";
}
