export const APP_ENV_VALUES = ["local", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENV_VALUES)[number];

export const ENV = {
  expoAppEnv: "EXPO_PUBLIC_APP_ENV",
  expoSupabaseUrl: "EXPO_PUBLIC_SUPABASE_URL",
  expoSupabasePublishableKey: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  nextAppEnv: "NEXT_PUBLIC_APP_ENV",
  nextSupabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  nextSupabasePublishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  supabaseUrl: "SUPABASE_URL",
  supabaseSecretKey: "SUPABASE_SECRET_KEY",
} as const;
