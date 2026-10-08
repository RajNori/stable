import { render } from "@testing-library/react-native";
import React from "react";

import RootLayout from "./_layout";

declare const jest: any;

jest.mock("expo-router", () => ({ Slot: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../src/auth-refresh-lifecycle", () => ({
  bindMobileAuthRefreshLifecycle: () => undefined,
}));
jest.mock("../src/boot-env", () => ({
  loadMobileBootEnv: () => undefined,
}));
jest.mock("../src/supabase-client", () => ({
  getMobileSupabaseClient: () => ({ auth: {} }),
}));

describe("mobile root layout", () => {
  it("loads the app environment and binds auth refresh before rendering providers", async () => {
    expect(await render(<RootLayout />)).toBeTruthy();
  });
});
