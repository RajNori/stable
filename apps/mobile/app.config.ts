import type { ExpoConfig } from "expo/config";

type EnvSource = Readonly<Record<string, string | undefined>>;

export function assertNoSupabaseSecretInExpoPublicEnv(env: EnvSource): void {
  const secrets = new Set(
    Object.entries(env)
      .filter(
        (entry): entry is [string, string] =>
          /^SUPABASE_.*(SECRET|SERVICE_ROLE|SERVICE_KEY|ACCESS_TOKEN).*$/i.test(
            entry[0],
          ) &&
          typeof entry[1] === "string" &&
          entry[1].trim().length > 0,
      )
      .map(([, value]) => value.trim()),
  );
  for (const [key, rawValue] of Object.entries(env)) {
    if (!key.startsWith("EXPO_PUBLIC_") || typeof rawValue !== "string") {
      continue;
    }
    if (
      /^EXPO_PUBLIC_.*(SECRET|SERVICE_ROLE|SERVICE_KEY|ACCESS_TOKEN).*$/i.test(
        key,
      )
    ) {
      throw new Error(
        `Supabase privileged credentials are not allowed in public Expo variables (${key}).`,
      );
    }
    const value = rawValue.trim();
    if (
      value.length > 0 &&
      (value.startsWith("sb_secret_") ||
        hasServiceRoleJwtClaim(value) ||
        secrets.has(value))
    ) {
      throw new Error(
        `Supabase privileged credentials are not allowed in public Expo variables (${key}).`,
      );
    }
  }
}

function hasServiceRoleJwtClaim(value: string): boolean {
  const payload = value.split(".")[1];
  if (payload === undefined || value.split(".").length !== 3) return false;

  try {
    const claims = JSON.parse(decodeBase64UrlAscii(payload)) as {
      role?: unknown;
    };
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

function decodeBase64UrlAscii(value: string): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  let buffer = 0;
  let bits = 0;
  let decoded = "";

  for (const character of normalized) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error("Invalid base64url payload");
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      decoded += String.fromCharCode((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  return decoded;
}

// Expo statically embeds EXPO_PUBLIC_* values during bundling. Reject known
// Supabase secret/service-role credentials while resolving app config, before
// Metro can place one in a distributable client bundle.
assertNoSupabaseSecretInExpoPublicEnv(process.env);

const config = {
  name: "The Stable",
  slug: "stable",
  scheme: "stable",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "app.stable.mobile",
    supportsTablet: true,
  },
  android: {
    package: "app.stable.mobile",
  },
  plugins: ["expo-router", "expo-notifications"],
} satisfies ExpoConfig;

export default config;
