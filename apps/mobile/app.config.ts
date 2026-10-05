import type { ExpoConfig } from "expo/config";

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
  plugins: ["expo-router"],
} satisfies ExpoConfig;

export default config;
