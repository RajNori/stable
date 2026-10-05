import { defineConfig } from "vitest/config";

/**
 * Coverage exclusions:
 * - generated Supabase types (`*.generated.ts`)
 * - declarative design-token maps (`palette.ts`, `scales.ts`) with no behaviour
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.generated.ts",
        "src/palette.ts",
        "src/scales.ts",
      ],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
