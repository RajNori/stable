import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createClient: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../lib/supabase/browser", () => ({
  createSupabaseBrowserClient: mocks.createClient,
}));
vi.mock("../lib/auth-session", () => ({
  signOutLiveWebAuthSession: mocks.signOut,
}));

import { SignOutButton } from "./sign-out-button";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("sign out button", () => {
  it("waits for local sign out before refreshing the protected page", async () => {
    const client = { auth: {} };
    let complete: (() => void) | undefined;
    mocks.createClient.mockReturnValue(client);
    mocks.signOut.mockImplementation(
      () => new Promise<void>((resolve) => (complete = resolve)),
    );
    render(
      <SignOutButton
        supabaseUrl="https://stable.example.test"
        publishableKey="sb_publishable_test"
      />,
    );

    const button = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.createClient).toHaveBeenCalledWith({
      url: "https://stable.example.test",
      publishableKey: "sb_publishable_test",
    });
    expect(mocks.signOut).toHaveBeenCalledWith(client);
    expect(mocks.refresh).not.toHaveBeenCalled();

    complete?.();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
