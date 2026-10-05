import { mustangsPalette } from "./palette.js";
import { radius, shadow, space, typeScale } from "./scales.js";

export const THEME_KEYS = ["mustangs"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export const SEMANTIC_COLOR_TOKENS = [
  "color.brand.primary",
  "color.brand.primaryStrong",
  "color.brand.accent",
  "color.brand.accentSoft",
  "color.background.canvas",
  "color.background.surface",
  "color.background.surfaceAlt",
  "color.background.inverse",
  "color.text.primary",
  "color.text.secondary",
  "color.text.muted",
  "color.text.inverse",
  "color.border.default",
  "color.border.strong",
  "color.state.success",
  "color.state.successSoft",
  "color.state.warning",
  "color.state.warningSoft",
  "color.state.error",
  "color.state.errorSoft",
  "color.state.info",
  "color.state.infoSoft",
] as const;

export type SemanticColorToken = (typeof SEMANTIC_COLOR_TOKENS)[number];

const mustangsColorIndex = new Map<SemanticColorToken, string>([
  ["color.brand.primary", mustangsPalette.green800],
  ["color.brand.primaryStrong", mustangsPalette.green950],
  ["color.brand.accent", mustangsPalette.gold500],
  ["color.brand.accentSoft", mustangsPalette.gold100],
  ["color.background.canvas", mustangsPalette.neutral050],
  ["color.background.surface", mustangsPalette.white],
  ["color.background.surfaceAlt", mustangsPalette.neutral100],
  ["color.background.inverse", mustangsPalette.green950],
  ["color.text.primary", mustangsPalette.neutral950],
  ["color.text.secondary", mustangsPalette.neutral700],
  ["color.text.muted", mustangsPalette.neutral500],
  ["color.text.inverse", mustangsPalette.white],
  ["color.border.default", mustangsPalette.neutral200],
  ["color.border.strong", mustangsPalette.neutral300],
  ["color.state.success", mustangsPalette.success600],
  ["color.state.successSoft", mustangsPalette.success100],
  ["color.state.warning", mustangsPalette.warning600],
  ["color.state.warningSoft", mustangsPalette.warning100],
  ["color.state.error", mustangsPalette.error600],
  ["color.state.errorSoft", mustangsPalette.error100],
  ["color.state.info", mustangsPalette.info600],
  ["color.state.infoSoft", mustangsPalette.info100],
]);

export type SemanticTheme = {
  key: ThemeKey;
  color: {
    brand: {
      primary: string;
      primaryStrong: string;
      accent: string;
      accentSoft: string;
    };
    background: {
      canvas: string;
      surface: string;
      surfaceAlt: string;
      inverse: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
      inverse: string;
    };
    border: {
      default: string;
      strong: string;
    };
    state: {
      success: string;
      successSoft: string;
      warning: string;
      warningSoft: string;
      error: string;
      errorSoft: string;
      info: string;
      infoSoft: string;
    };
  };
  space: typeof space;
  radius: typeof radius;
  typeScale: typeof typeScale;
  shadow: typeof shadow;
};

const mustangsTheme: SemanticTheme = {
  key: "mustangs",
  color: {
    brand: {
      primary: mustangsPalette.green800,
      primaryStrong: mustangsPalette.green950,
      accent: mustangsPalette.gold500,
      accentSoft: mustangsPalette.gold100,
    },
    background: {
      canvas: mustangsPalette.neutral050,
      surface: mustangsPalette.white,
      surfaceAlt: mustangsPalette.neutral100,
      inverse: mustangsPalette.green950,
    },
    text: {
      primary: mustangsPalette.neutral950,
      secondary: mustangsPalette.neutral700,
      muted: mustangsPalette.neutral500,
      inverse: mustangsPalette.white,
    },
    border: {
      default: mustangsPalette.neutral200,
      strong: mustangsPalette.neutral300,
    },
    state: {
      success: mustangsPalette.success600,
      successSoft: mustangsPalette.success100,
      warning: mustangsPalette.warning600,
      warningSoft: mustangsPalette.warning100,
      error: mustangsPalette.error600,
      errorSoft: mustangsPalette.error100,
      info: mustangsPalette.info600,
      infoSoft: mustangsPalette.info100,
    },
  },
  space,
  radius,
  typeScale,
  shadow,
};

export function semanticColor(token: string): string {
  const value = (mustangsColorIndex as Map<string, string>).get(token);
  if (value === undefined) {
    throw new Error(`Missing semantic color: ${token}`);
  }
  return value;
}

export function themeFor(themeKey: string): SemanticTheme {
  if (themeKey !== "mustangs") {
    throw new Error(`Unknown theme key: ${themeKey}`);
  }
  return mustangsTheme;
}
