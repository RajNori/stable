import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const platformNeutralFiles = [
  "packages/contracts/**/*.ts",
  "packages/permissions/**/*.ts",
  "packages/features/**/domain/**/*.ts",
  "packages/features/**/application/**/*.ts",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/android/**",
      "**/ios/**",
      "packages/database-types/src/database.generated.ts",
      "pnpm-lock.yaml",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["apps/**/*.ts", "apps/**/*.tsx", ...platformNeutralFiles],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@stable/database-types",
              message:
                "Database types stay in infrastructure adapters. Apps and contracts use application DTOs.",
            },
          ],
        },
      ],
    },
  },
  {
    files: platformNeutralFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@stable/database-types",
              message: "Database types stay in infrastructure adapters.",
            },
            {
              name: "@supabase/supabase-js",
              message: "Domain and contracts stay platform-neutral.",
            },
            {
              name: "react",
              message: "Domain and contracts stay platform-neutral.",
            },
            {
              name: "react-native",
              message: "Domain and contracts stay platform-neutral.",
            },
            {
              name: "expo",
              message: "Domain and contracts stay platform-neutral.",
            },
            {
              name: "next",
              message: "Domain and contracts stay platform-neutral.",
            },
          ],
        },
      ],
    },
  },
);
