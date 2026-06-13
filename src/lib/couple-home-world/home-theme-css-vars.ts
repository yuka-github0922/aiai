export const HOME_THEME_CSS_VARS = [
  "--home-bg-base",
  "--home-bg-gradient",
  "--home-bg-grid-color",
  "--home-hero-bg",
  "--home-hero-border",
  "--home-hero-placeholder-from",
  "--home-hero-placeholder-to",
  "--home-hero-card-bg",
  "--home-hero-card-shadow",
  "--home-accent-heart",
  "--home-accent-subtitle",
  "--home-accent-num",
  "--home-accent-num-shadow",
  "--home-accent-num-label",
  "--home-accent-anniversary",
  "--home-accent-marker",
  "--home-accent-body",
  "--home-label-bg",
  "--home-label-text",
  "--couple-phrase-color",
  "--couple-trait-shell-bg",
  "--couple-trait-shell-border",
  "--couple-trait-row-bg",
  "--couple-trait-row-border",
] as const;

export type HomeThemeCssVar = (typeof HOME_THEME_CSS_VARS)[number];

export type HomeThemeCssVars = Record<HomeThemeCssVar, string>;
