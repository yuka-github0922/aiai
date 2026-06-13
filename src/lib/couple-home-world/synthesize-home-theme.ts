import type {
  AccentDirection,
  BackgroundDirection,
  ExpressionTokens,
  HomeTheme,
  HomeThemeAccentTokens,
  HomeThemePalette,
  ThemeDirections,
} from "@/lib/couple-home-world/types";
import { HOME_THEME_MATCHER_VERSION } from "@/lib/couple-home-world/types";
import type { HomeThemeCssVars } from "@/lib/couple-home-world/home-theme-css-vars";
import { deriveExpressionTokens, isExpressionTokens } from "@/lib/couple-home-world/derive-expression-tokens";
import { buildBackgroundStructureLayers } from "@/lib/couple-home-world/home-theme-structures";

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function paletteFromDirections(
  bg: BackgroundDirection,
  accent: AccentDirection
): HomeThemePalette {
  const primary = hsl(bg.hue_base, 42 + bg.openness * 12, bg.lightness);
  const secondary = hsl(
    (bg.hue_base + bg.hue_spread) % 360,
    38 + bg.texture * 10,
    bg.lightness + 6
  );
  const sky = hsl((bg.hue_base + 12) % 360, 35, Math.min(bg.lightness + 12, 92));
  const ground = hsl(
    (bg.hue_base - 18 + 360) % 360,
    30 + bg.warmth * 15,
    bg.lightness - 8
  );
  const surface = hsl(
    bg.hue_base,
    18 + bg.texture * 12,
    Math.min(bg.lightness + 18, 96),
    bg.depth > 0.45 ? 0.88 : 0.96
  );

  return {
    primary,
    secondary,
    accent: hsl(accent.hue, accent.saturation, accent.lightness),
    sky,
    ground,
    surface,
    text_muted: hsl(bg.hue_base, 12, bg.depth > 0.4 ? 72 : 42, 0.85),
  };
}

function accentTokensFromDirections(
  bg: BackgroundDirection,
  accent: AccentDirection
): HomeThemeAccentTokens {
  const heart = hsl(accent.hue, accent.saturation, accent.lightness);
  const subtitle = hsl(bg.hue_base, 22, bg.lightness - 18, 0.88);
  const num = hsl(accent.hue, accent.saturation + 8, accent.lightness - 4);
  const numShadow = hsl((accent.hue + 40) % 360, 55, 72, 0.45);
  const labelBg = hsl(
    (bg.hue_base + 50) % 360,
    55 + bg.warmth * 15,
    82 + bg.warmth * 6
  );
  const labelText = hsl(bg.hue_base, 35, 28 + bg.depth * 12);

  return {
    heart,
    subtitle,
    label_bg: labelBg,
    label_text: labelText,
    num,
    num_shadow: numShadow,
    num_label: hsl(bg.hue_base, 28, bg.lightness - 14, 0.9),
    marker_highlight: hsl((accent.hue + 55) % 360, 70, 78, 0.55),
    anniversary_accent: hsl(accent.hue, accent.saturation, accent.lightness - 2),
    body: hsl(bg.hue_base, 10, bg.depth > 0.4 ? 78 : 38, 0.9),
  };
}

function heroSurroundVars(
  directions: ThemeDirections,
  palette: HomeThemePalette
): Pick<
  HomeThemeCssVars,
  | "--home-hero-bg"
  | "--home-hero-border"
  | "--home-hero-placeholder-from"
  | "--home-hero-placeholder-to"
> {
  const { background, skeleton } = directions;
  const structure = skeleton.hero_surround_structure;

  let heroBg = palette.surface;
  let heroBorder = hsl(background.hue_base, 10, 98, 0.95);

  switch (structure) {
    case "arch_glass":
      heroBg = hsl(background.hue_base, 22, background.lightness - 6, 0.72);
      heroBorder = hsl(background.hue_base, 35, 70, 0.35);
      break;
    case "arch_inner_glow":
      heroBg = `linear-gradient(180deg, ${palette.surface} 0%, ${hsl(background.hue_base, 28, background.lightness - 4, 0.85)} 100%)`;
      break;
    case "arch_tinted":
      heroBg = hsl(background.hue_base, 20, background.lightness + 10, 0.92);
      heroBorder = hsl(background.hue_base, 18, 94);
      break;
    case "arch_flat":
    default:
      heroBg = palette.surface;
      break;
  }

  const placeholderFrom = hsl(background.hue_base, 35, background.lightness + 8, 0.95);
  const placeholderTo = hsl(
    (background.hue_base + background.hue_spread) % 360,
    30,
    background.lightness - 2,
    0.9
  );

  return {
    "--home-hero-bg": heroBg,
    "--home-hero-border": heroBorder,
    "--home-hero-placeholder-from": placeholderFrom,
    "--home-hero-placeholder-to": placeholderTo,
  };
}

function coupleTraitVars(
  bg: BackgroundDirection,
  palette: HomeThemePalette,
  tokens: HomeThemeAccentTokens,
  expression: ExpressionTokens
): Pick<
  HomeThemeCssVars,
  | "--couple-phrase-color"
  | "--couple-trait-shell-bg"
  | "--couple-trait-shell-border"
  | "--couple-trait-row-bg"
  | "--couple-trait-row-border"
> {
  const shellBg = palette.surface;
  const shellBorder = hsl(bg.hue_base, 10, 98, 0.95);
  let rowBg = hsl(bg.hue_base, 18 + bg.texture * 8, bg.lightness + 10);
  let rowBorder = hsl(bg.hue_base, 14, 92);
  let phraseColor = tokens.body;

  switch (expression.material) {
    case "panel":
      rowBg = hsl(bg.hue_base, 14, 32, 0.85);
      rowBorder = hsl(bg.hue_base, 18, 45, 0.6);
      phraseColor = hsl(bg.hue_base, 8, 88, 0.95);
      break;
    case "paper":
      rowBg = "#ffffff";
      rowBorder = "#e7e5e4";
      break;
    case "glass":
      rowBg = hsl(bg.hue_base, 14, bg.lightness + 14, 0.72);
      rowBorder = hsl(bg.hue_base, 12, 94, 0.55);
      break;
    case "soft":
    default:
      if (expression.density === "airy") {
        rowBg = hsl(bg.hue_base, 14, bg.lightness + 14, 0.82);
        rowBorder = hsl(bg.hue_base, 12, 94, 0.55);
      }
      break;
  }

  return {
    "--couple-phrase-color": phraseColor,
    "--couple-trait-shell-bg": shellBg,
    "--couple-trait-shell-border": shellBorder,
    "--couple-trait-row-bg": rowBg,
    "--couple-trait-row-border": rowBorder,
  };
}

export function synthesizeHomeTheme(directions: ThemeDirections): HomeTheme {
  const palette = paletteFromDirections(directions.background, directions.accent);
  const accent_tokens = accentTokensFromDirections(
    directions.background,
    directions.accent
  );

  const expression = deriveExpressionTokens(directions.background);

  const bg = directions.background;
  const gradient = `linear-gradient(160deg, ${hsl(bg.hue_base, 38, bg.lightness + 6)} 0%, ${hsl((bg.hue_base + bg.hue_spread) % 360, 32, bg.lightness)} 35%, ${hsl((bg.hue_base - bg.hue_spread * 0.5 + 360) % 360, 28, bg.lightness - 2)} 65%, ${hsl(bg.hue_base, 12, Math.min(bg.lightness + 14, 98))} 100%)`;

  const gridColor = hsl(bg.hue_base, 18, 50, bg.grid_opacity);
  const backgroundImage = buildBackgroundStructureLayers(
    directions.skeleton.background_structure,
    gridColor,
    gradient
  );

  const heroVars = heroSurroundVars(directions, palette);
  const traitVars = coupleTraitVars(bg, palette, accent_tokens, expression);

  const shadowHue = (bg.hue_base + 220) % 360;
  const css_vars: HomeThemeCssVars = {
    "--home-bg-base": hsl(bg.hue_base, 20, bg.lightness + 4),
    "--home-bg-gradient": backgroundImage,
    "--home-bg-grid-color": gridColor,
    ...heroVars,
    "--home-hero-card-bg": palette.surface,
    "--home-hero-card-shadow": hsl(shadowHue, 15, 55, 0.22),
    "--home-accent-heart": accent_tokens.heart,
    "--home-accent-subtitle": accent_tokens.subtitle,
    "--home-accent-num": accent_tokens.num,
    "--home-accent-num-shadow": accent_tokens.num_shadow,
    "--home-accent-num-label": accent_tokens.num_label,
    "--home-accent-anniversary": accent_tokens.anniversary_accent,
    "--home-accent-marker": accent_tokens.marker_highlight,
    "--home-accent-body": accent_tokens.body,
    "--home-label-bg": accent_tokens.label_bg,
    "--home-label-text": accent_tokens.label_text,
    ...traitVars,
  };

  return {
    derived_at: new Date().toISOString(),
    matcher_version: HOME_THEME_MATCHER_VERSION,
    directions,
    expression,
    palette,
    accent_tokens,
    css_vars,
  };
}

/** v3 保存前の home_theme に expression が無い場合の read-time 補完 */
export function resolveHomeThemeFields(homeTheme: HomeTheme): {
  expression: ExpressionTokens;
  cssVars: HomeThemeCssVars;
} {
  const bg = homeTheme.directions.background;
  const derived = deriveExpressionTokens(bg);

  if (
    homeTheme.matcher_version === HOME_THEME_MATCHER_VERSION &&
    isExpressionTokens(homeTheme.expression)
  ) {
    return {
      expression: homeTheme.expression,
      cssVars: homeTheme.css_vars,
    };
  }

  if (isExpressionTokens(homeTheme.expression)) {
    const refreshed = synthesizeHomeTheme(homeTheme.directions);
    return {
      expression: homeTheme.expression,
      cssVars: refreshed.css_vars,
    };
  }

  const refreshed = synthesizeHomeTheme(homeTheme.directions);
  return {
    expression: refreshed.expression ?? derived,
    cssVars: refreshed.css_vars,
  };
}
