/** Declarative spacing, radius, type, and shadow scales. Excluded from coverage. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  hero: 24,
  pill: 999,
} as const;

export const typeScale = {
  displayLg: { fontSize: 44, lineHeight: 48, fontWeight: "800" },
  displayMd: { fontSize: 36, lineHeight: 40, fontWeight: "800" },
  headingXl: { fontSize: 32, lineHeight: 36, fontWeight: "750" },
  headingLg: { fontSize: 28, lineHeight: 32, fontWeight: "750" },
  headingMd: { fontSize: 24, lineHeight: 28, fontWeight: "700" },
  headingSm: { fontSize: 20, lineHeight: 24, fontWeight: "700" },
  titleLg: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  titleMd: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  titleSm: { fontSize: 15, lineHeight: 20, fontWeight: "650" },
  bodyLg: { fontSize: 17, lineHeight: 24, fontWeight: "450" },
  bodyMd: { fontSize: 16, lineHeight: 23, fontWeight: "450" },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: "450" },
  labelLg: { fontSize: 15, lineHeight: 20, fontWeight: "650" },
  labelMd: { fontSize: 14, lineHeight: 18, fontWeight: "650" },
  labelSm: { fontSize: 13, lineHeight: 17, fontWeight: "650" },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: "500" },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
} as const;

export const shadow = {
  none: "none",
  sm: "0 1px 2px rgba(17, 22, 19, 0.06)",
  md: "0 8px 24px rgba(17, 22, 19, 0.12)",
} as const;
