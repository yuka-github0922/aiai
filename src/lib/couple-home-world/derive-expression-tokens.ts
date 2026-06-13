import type {
  BackgroundDirection,
  ExpressionDensity,
  ExpressionHeading,
  ExpressionMaterial,
  ExpressionTokens,
  ExpressionTypography,
} from "@/lib/couple-home-world/types";
import { EXPRESSION_MATCHER_VERSION } from "@/lib/couple-home-world/types";

export function deriveExpressionTokens(
  background: BackgroundDirection
): ExpressionTokens {
  let density: ExpressionDensity = "balanced";
  if (background.depth >= 0.45 && background.lightness < 55) {
    density = "compact";
  } else if (background.openness >= 0.55) {
    density = "airy";
  }

  let material: ExpressionMaterial = "soft";
  if (background.depth >= 0.48 && background.lightness < 58) {
    material = "panel";
  } else if (background.texture >= 0.42 && background.warmth >= 0.2) {
    material = "paper";
  } else if (background.openness >= 0.45 || background.warmth < 0.05) {
    material = "glass";
  }

  const typography: ExpressionTypography =
    material === "panel"
      ? "mono"
      : material === "paper" && background.texture >= 0.4
        ? "hand"
        : material === "glass"
          ? "serif"
          : "sans";

  const heading: ExpressionHeading =
    material === "panel"
      ? "badge"
      : material === "paper"
        ? "tape"
        : material === "glass"
          ? "rule"
          : "minimal";

  return {
    density,
    material,
    typography,
    heading,
    matcher_version: EXPRESSION_MATCHER_VERSION,
  };
}

const DENSITIES: ExpressionDensity[] = ["airy", "balanced", "compact"];
const MATERIALS: ExpressionMaterial[] = ["glass", "paper", "panel", "soft"];
const TYPOGRAPHIES: ExpressionTypography[] = ["serif", "sans", "mono", "hand"];
const HEADINGS: ExpressionHeading[] = ["minimal", "rule", "badge", "tape"];

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/** QA / dev override: `?express=airy,glass,serif,rule` */
export function parseExpressionOverride(raw: string | undefined): ExpressionTokens | null {
  if (!raw?.trim()) return null;

  const parts = raw.split(",").map((p) => p.trim().toLowerCase());
  if (parts.length !== 4) return null;

  const [density, material, typography, heading] = parts;
  if (
    !isOneOf(density, DENSITIES) ||
    !isOneOf(material, MATERIALS) ||
    !isOneOf(typography, TYPOGRAPHIES) ||
    !isOneOf(heading, HEADINGS)
  ) {
    return null;
  }

  return {
    density,
    material,
    typography,
    heading,
    matcher_version: EXPRESSION_MATCHER_VERSION,
  };
}

export function isExpressionTokens(value: unknown): value is ExpressionTokens {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<ExpressionTokens>;
  return (
    isOneOf(t.density ?? "", DENSITIES) &&
    isOneOf(t.material ?? "", MATERIALS) &&
    isOneOf(t.typography ?? "", TYPOGRAPHIES) &&
    isOneOf(t.heading ?? "", HEADINGS) &&
    t.matcher_version === EXPRESSION_MATCHER_VERSION
  );
}

/** QA fixture backgrounds that yield the three presentation patterns. */
export const EXPRESSION_QA_FIXTURES = {
  glassRoom: {
    label: "airy + glass + serif + rule",
    background: {
      hue_base: 200,
      hue_spread: 24,
      lightness: 78,
      warmth: -0.2,
      openness: 0.62,
      depth: 0.2,
      texture: 0.15,
      grid_opacity: 0.04,
    },
    expected: {
      density: "airy",
      material: "glass",
      typography: "serif",
      heading: "rule",
    },
  },
  panelRoom: {
    label: "compact + panel + mono + badge",
    background: {
      hue_base: 280,
      hue_spread: 32,
      lightness: 48,
      warmth: 0.1,
      openness: 0.25,
      depth: 0.55,
      texture: 0.2,
      grid_opacity: 0.08,
    },
    expected: {
      density: "compact",
      material: "panel",
      typography: "mono",
      heading: "badge",
    },
  },
  paperRoom: {
    label: "balanced + paper + hand + tape",
    background: {
      hue_base: 38,
      hue_spread: 18,
      lightness: 72,
      warmth: 0.35,
      openness: 0.4,
      depth: 0.25,
      texture: 0.48,
      grid_opacity: 0.05,
    },
    expected: {
      density: "balanced",
      material: "paper",
      typography: "hand",
      heading: "tape",
    },
  },
} as const;
