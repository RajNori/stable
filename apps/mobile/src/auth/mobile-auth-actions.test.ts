import type { OtpAuthClient } from "@stable/auth";

import {
  createCallbackVerifierStorage,
  createMobileAuthActions,
  type CallbackSession,
  type DeferredCallbackAuth,
} from "./mobile-auth-actions";

const callbackUrl = "stable://auth/callback?code=accepted-code";
const session: CallbackSession = {
  access_token: "new-access-token",
  refresh_token: "new-refresh-token",
  user: { id: "22000000-0000-4000-8000-000000000002" },
};

function otpClient(): OtpAuthClient {
  return {
    requestEmailOtp: async () => undefined,
    verifyEmailOtp: async () => ({ id: session.user.id }),
    exchangeEmailCode: async () => ({ id: session.user.id }),
    requestPhoneOtp: async () => undefined,
    verifyPhoneOtp: async () => ({ id: session.user.id }),
  };
}

describe("mobile callback session transaction", () => {
  it("cleans the prior account before committing an accepted callback session", async () => {
    const order: string[] = [];
    const callbackAuth: DeferredCallbackAuth = {
      exchange: async () => {
        order.push("exchange");
        return session;
      },
      commit: async () => {
        order.push("commit");
      },
    };
    const actions = createMobileAuthActions(
      otpClient(),
      "staging",
      callbackAuth,
    );

    const next = await actions.completeCallback(
      callbackUrl,
      async (snapshot) => {
        expect(snapshot).toEqual({
          state: "authenticated",
          principal: { userId: session.user.id },
        });
        order.push("cleanup");
      },
    );

    expect(next.state).toBe("authenticated");
    expect(order).toEqual(["exchange", "cleanup", "commit"]);
  });

  it("does not clean or commit when the callback exchange is rejected", async () => {
    const order: string[] = [];
    const callbackAuth: DeferredCallbackAuth = {
      exchange: async () => {
        order.push("exchange");
        throw new Error("rejected");
      },
      commit: async () => {
        order.push("commit");
      },
    };
    const actions = createMobileAuthActions(
      otpClient(),
      "staging",
      callbackAuth,
    );

    await expect(
      actions.completeCallback(callbackUrl, async () => {
        order.push("cleanup");
      }),
    ).rejects.toThrow("rejected");
    expect(order).toEqual(["exchange"]);
  });

  it("rejects an untrusted callback URL before exchanging a code", async () => {
    const order: string[] = [];
    const callbackAuth: DeferredCallbackAuth = {
      exchange: async () => {
        order.push("exchange");
        return session;
      },
      commit: async () => {
        order.push("commit");
      },
    };
    const actions = createMobileAuthActions(
      otpClient(),
      "staging",
      callbackAuth,
    );

    await expect(
      actions.completeCallback(
        "https://attacker.example/auth/callback?code=untrusted",
        async () => {
          order.push("cleanup");
        },
      ),
    ).rejects.toThrow();
    expect(order).toEqual([]);
  });

  it("gives the temporary auth client access only to the PKCE verifier", async () => {
    const calls: string[] = [];
    const verifierKey = "sb-project-auth-token-code-verifier";
    const storage = {
      getItem: async (key: string) => {
        calls.push(`get:${key}`);
        return "pkce-verifier";
      },
      setItem: async (key: string) => {
        calls.push(`set:${key}`);
      },
      removeItem: async (key: string) => {
        calls.push(`remove:${key}`);
      },
    };
    const callbackStorage = createCallbackVerifierStorage(storage, verifierKey);

    expect(await callbackStorage.getItem(verifierKey)).toBe("pkce-verifier");
    expect(await callbackStorage.getItem("sb-project-auth-token")).toBeNull();
    await callbackStorage.setItem("sb-project-auth-token", "session-bytes");
    await callbackStorage.removeItem("sb-project-auth-token");
    await callbackStorage.removeItem(verifierKey);
    expect(calls).toEqual([`get:${verifierKey}`, `remove:${verifierKey}`]);
  });
});
