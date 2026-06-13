import type { CoupleHomeWorldRow, ParsedWorldBible } from "@/lib/couple-home-world/types";
import { HOME_WORLD_ESTABLISHMENT_THRESHOLD } from "@/lib/couple-home-world/types";
import { resolveHomeThemeFields } from "@/lib/couple-home-world/synthesize-home-theme";

export function resolveWorldPhrase(
  worldBible: ParsedWorldBible | null,
  sceneState: "nascent" | "establishing" | "ready"
): string | null {
  if (sceneState === "nascent") {
    return "ふたりの世界";
  }

  const phrase = worldBible?.worldIdentity?.phrase?.trim();
  if (phrase) return phrase;

  if (sceneState === "establishing") {
    return "ふたりの世界を描いています…";
  }

  return null;
}

export function isCoupleWorldActive(
  revealedCount: number,
  row: CoupleHomeWorldRow | null
): boolean {
  return revealedCount >= HOME_WORLD_ESTABLISHMENT_THRESHOLD || !!row?.worldBible;
}

export function resolveCoupleWorldTheme(row: CoupleHomeWorldRow | null) {
  const homeTheme = row?.worldBible?.homeTheme ?? null;
  if (!homeTheme) {
    return {
      homeThemeCssVars: null,
      expression: null,
    };
  }

  const resolved = resolveHomeThemeFields(homeTheme);
  return {
    homeThemeCssVars: resolved.cssVars,
    expression: resolved.expression,
  };
}
