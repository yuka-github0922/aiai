import type {
  BackgroundStructureId,
  HeroSurroundStructureId,
  ThemeDirections,
} from "@/lib/couple-home-world/types";

export function selectBackgroundStructure(
  background: ThemeDirections["background"]
): BackgroundStructureId {
  if (background.depth >= 0.55) return "dark_glow";
  if (background.texture >= 0.45) return "paper_grid";
  if (background.openness >= 0.65) return "soft_wash";
  return "grid_gradient";
}

export function selectHeroSurroundStructure(
  background: ThemeDirections["background"],
  accent: ThemeDirections["accent"]
): HeroSurroundStructureId {
  if (background.depth >= 0.5) return "arch_glass";
  if (accent.softness >= 0.65) return "arch_inner_glow";
  if (background.warmth >= 0.35) return "arch_tinted";
  return "arch_flat";
}

/** 骨格のみ — 色は ThemeDirections から合成 */
export function buildBackgroundStructureLayers(
  structure: BackgroundStructureId,
  gridColor: string,
  gradient: string
): string {
  const gridH = `repeating-linear-gradient(0deg, transparent, transparent 23px, ${gridColor} 23px, ${gridColor} 24px)`;
  const gridV = `repeating-linear-gradient(90deg, transparent, transparent 23px, ${gridColor} 23px, ${gridColor} 24px)`;

  switch (structure) {
    case "plain_gradient":
      return gradient;
    case "soft_wash":
      return `${gradient}`;
    case "paper_grid":
      return `${gridH}, ${gridV}, ${gradient}`;
    case "dark_glow":
      return `${gradient}`;
    case "grid_gradient":
    default:
      return `${gridH}, ${gridV}, ${gradient}`;
  }
}
