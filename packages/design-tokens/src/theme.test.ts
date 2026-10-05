import { describe, expect, it } from "vitest";

import { SEMANTIC_COLOR_TOKENS, semanticColor, themeFor } from "./theme.js";

describe("mustangs theme", () => {
  it("maps semantic brand, canvas, and accent tokens from the approved palette", () => {
    const theme = themeFor("mustangs");

    expect(theme.key).toBe("mustangs");
    expect(theme.color.brand.primary).toBe("#07503E");
    expect(theme.color.brand.primaryStrong).toBe("#04372C");
    expect(theme.color.brand.accent).toBe("#FFD91A");
    expect(theme.color.background.canvas).toBe("#F7F8F5");
    expect(theme.color.text.primary).toBe("#111613");
    expect(theme.space[4]).toBe(16);
    expect(theme.radius.lg).toBe(16);
    expect(theme.typeScale.bodyMd.fontSize).toBe(16);
    expect(theme.shadow.none).toBe("none");
  });

  it("resolves every semantic color token", () => {
    for (const token of SEMANTIC_COLOR_TOKENS) {
      expect(semanticColor(token).startsWith("#")).toBe(true);
    }
  });

  it("rejects an unknown theme key and an unknown color token", () => {
    expect(() => themeFor("other-club")).toThrow(/Unknown theme key/);
    expect(() => semanticColor("color.nope")).toThrow(/Missing semantic color/);
  });
});
