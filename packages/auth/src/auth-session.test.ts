import { describe, expect, it } from "vitest";

import {
  providerFailureRead,
  refreshAuthSession,
  restoreAuthSession,
  signOutAuthSession,
  type AuthSessionGateway,
  type PersistedSessionRead,
  type StoredPrincipalFact,
} from "./index.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = 1_700_000_000_000;
const leakedEmail = "person@example.com";

const currentPrincipal: StoredPrincipalFact = {
  userId,
  displayName: "Alex M",
  accessExpiresAt: now + 60_000,
};

const expiredPrincipal: StoredPrincipalFact = {
  userId,
  accessExpiresAt: now,
};

function principalRead(principal: StoredPrincipalFact): PersistedSessionRead {
  return { kind: "principal", principal };
}

describe("providerFailureRead", () => {
  it("treats credential expiry as expired and outages as unavailable", () => {
    expect(
      providerFailureRead({ status: 401, code: "session_expired" }),
    ).toEqual({ kind: "expired" });
    expect(
      providerFailureRead({
        code: "otp_expired",
        message: `invalid OTP for ${leakedEmail}`,
      }),
    ).toEqual({ kind: "expired" });
    expect(
      providerFailureRead({
        status: 503,
        message: `Apple down ${leakedEmail}`,
      }),
    ).toEqual({
      kind: "unavailable",
      error: { status: 503, message: `Apple down ${leakedEmail}` },
    });
    expect(providerFailureRead({ status: 429 })).toEqual({
      kind: "unavailable",
      error: { status: 429 },
    });
  });
});

describe("restoreAuthSession", () => {
  it("restores a current principal without clearing or refreshing", async () => {
    const fake = fakeGateway({
      read: principalRead(currentPrincipal),
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: {
        state: "authenticated",
        principal: { userId, displayName: "Alex M" },
      },
      clearLocal: false,
    });
    expect(fake.clears).toBe(0);
    expect(fake.refreshes).toBe(0);
  });

  it("treats a principal with no expiry as still authenticated", async () => {
    const fake = fakeGateway({
      read: principalRead({
        userId,
        accessExpiresAt: null,
      }),
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toEqual({
      state: "authenticated",
      principal: { userId },
    });
    expect(fake.refreshes).toBe(0);
  });

  it("returns unauthenticated when nothing is stored", async () => {
    const fake = fakeGateway({ read: { kind: "none" } });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: false,
    });
    expect(fake.clears).toBe(0);
  });

  it("clears corrupt storage and does not echo it", async () => {
    const fake = fakeGateway({ read: { kind: "corrupt" } });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: true,
    });
    expect(fake.clears).toBe(1);
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
  });

  it("clears an invalid stored identity", async () => {
    const fake = fakeGateway({
      read: principalRead({
        userId: "not-a-uuid",
        accessExpiresAt: now + 60_000,
      }),
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toEqual({ state: "unauthenticated" });
    expect(fake.clears).toBe(1);
  });

  it("refreshes an expired access token into an authenticated principal", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refresh: principalRead({
        userId,
        displayName: "Alex M",
        accessExpiresAt: now + 3_600_000,
      }),
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(fake.refreshes).toBe(1);
    expect(fake.clears).toBe(0);
  });

  it("clears a rejected refresh and reports expired", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refresh: { kind: "expired" },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: { state: "expired" },
      clearLocal: true,
    });
    expect(fake.clears).toBe(1);
  });

  it("keeps a stored principal in recovery when refresh cannot reach the provider", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refresh: {
        kind: "unavailable",
        error: new TypeError(`Failed to fetch ${leakedEmail}`),
      },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.clearLocal).toBe(false);
    expect(decision.snapshot).toEqual({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
    expect(fake.clears).toBe(0);
  });

  it("does not report logout when the read itself is unavailable", async () => {
    const fake = fakeGateway({
      read: {
        kind: "unavailable",
        error: { status: 503, message: leakedEmail },
      },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(fake.clears).toBe(0);
  });

  it("returns unauthenticated when refresh finds no session", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refresh: { kind: "none" },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: false,
    });
  });

  it("clears a corrupt refresh result", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refresh: { kind: "corrupt" },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toEqual({ state: "unauthenticated" });
    expect(fake.clears).toBe(1);
  });

  it("recovers when refresh throws and does not clear", async () => {
    const fake = fakeGateway({
      read: principalRead(expiredPrincipal),
      refreshError: new TypeError("Failed to fetch"),
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(fake.clears).toBe(0);
  });

  it("recovers when reading storage throws", async () => {
    const fake = fakeGateway({
      readError: new TypeError(`Failed to fetch ${leakedEmail}`),
    });

    const decision = await restoreAuthSession(fake.gateway);

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
    expect(decision.snapshot.state).not.toBe("loading");
  });

  it("recovers when corrupt storage cannot be cleared", async () => {
    const fake = fakeGateway({
      read: { kind: "corrupt" },
      clearError: { status: 503 },
    });

    const decision = await restoreAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: {
        state: "recovery",
        errorCode: "UPSTREAM_UNAVAILABLE",
        message: "Sign-in is unavailable right now.",
      },
      clearLocal: false,
    });
  });
});

describe("refreshAuthSession", () => {
  it("returns the refreshed principal", async () => {
    const fake = fakeGateway({
      refresh: principalRead(currentPrincipal),
    });

    const decision = await refreshAuthSession(fake.gateway, now);

    expect(decision.snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(fake.refreshes).toBe(1);
    expect(fake.clears).toBe(0);
  });

  it("clears a revoked refresh", async () => {
    const fake = fakeGateway({ refresh: { kind: "expired" } });

    const decision = await refreshAuthSession(fake.gateway, now);

    expect(decision).toEqual({
      snapshot: { state: "expired" },
      clearLocal: true,
    });
  });

  it("returns unauthenticated when refresh finds nothing", async () => {
    const fake = fakeGateway({ refresh: { kind: "none" } });

    const decision = await refreshAuthSession(fake.gateway);

    expect(decision.snapshot).toEqual({ state: "unauthenticated" });
    expect(fake.clears).toBe(0);
  });

  it("recovers from an upstream refresh failure", async () => {
    const fake = fakeGateway({
      refresh: { kind: "unavailable", error: { status: 503 } },
    });

    const decision = await refreshAuthSession(fake.gateway, now);

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(fake.clears).toBe(0);
  });

  it("recovers when refresh throws", async () => {
    const fake = fakeGateway({
      refreshError: new TypeError("Failed to fetch"),
    });

    const decision = await refreshAuthSession(fake.gateway, now);

    expect(decision.snapshot).toMatchObject({ state: "recovery" });
    expect(decision.snapshot.state).not.toBe("unauthenticated");
  });
});

describe("signOutAuthSession", () => {
  it("returns unauthenticated after a local revoke clears storage", async () => {
    const fake = fakeGateway({ read: { kind: "none" } });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: false,
    });
    expect(fake.scopes).toEqual(["local"]);
  });

  it("passes global as a different revoke scope", async () => {
    const fake = fakeGateway({ read: { kind: "none" } });

    await signOutAuthSession(fake.gateway, "global");

    expect(fake.scopes).toEqual(["global"]);
  });

  it("still signs out this device when the network revoke fails after storage is empty", async () => {
    const fake = fakeGateway({
      read: { kind: "none" },
      revokeError: new TypeError(`Failed to fetch ${leakedEmail}`),
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.snapshot).toEqual({ state: "unauthenticated" });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
  });

  it("clears a principal that is still readable and then reports unauthenticated", async () => {
    const reads: PersistedSessionRead[] = [
      principalRead(currentPrincipal),
      { kind: "none" },
    ];
    const fake = fakeGateway({
      readSequence: reads,
      revokeError: new TypeError("Failed to fetch"),
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: true,
    });
    expect(fake.clears).toBe(1);
  });

  it("does not claim success when a principal remains after clear", async () => {
    const reads: PersistedSessionRead[] = [
      principalRead(currentPrincipal),
      principalRead(currentPrincipal),
    ];
    const fake = fakeGateway({ readSequence: reads });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.clearLocal).toBe(true);
    expect(decision.snapshot).toEqual({
      state: "recovery",
      errorCode: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
    expect(decision.snapshot.state).not.toBe("unauthenticated");
  });

  it("recovers when the follow-up clear throws", async () => {
    const fake = fakeGateway({
      read: principalRead(currentPrincipal),
      clearError: { status: 503, message: leakedEmail },
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
  });

  it("recovers when the follow-up read throws", async () => {
    let calls = 0;
    const fake = fakeGateway({
      readImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return principalRead(currentPrincipal);
        }
        throw new TypeError(`Failed to fetch ${leakedEmail}`);
      },
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.clearLocal).toBe(true);
    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("clears corrupt and expired reads without claiming the session remains", async () => {
    const corrupt = fakeGateway({ read: { kind: "corrupt" } });
    const expired = fakeGateway({ read: { kind: "expired" } });

    expect(
      (await signOutAuthSession(corrupt.gateway, "local")).snapshot,
    ).toEqual({ state: "unauthenticated" });
    expect(corrupt.clears).toBe(1);
    expect(
      (await signOutAuthSession(expired.gateway, "local")).snapshot,
    ).toEqual({ state: "unauthenticated" });
    expect(expired.clears).toBe(1);
  });

  it("clears a corrupt read that follows a principal", async () => {
    const fake = fakeGateway({
      readSequence: [principalRead(currentPrincipal), { kind: "corrupt" }],
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision).toEqual({
      snapshot: { state: "unauthenticated" },
      clearLocal: true,
    });
    expect(fake.clears).toBe(1);
  });

  it("recovers when the provider is unavailable during sign-out", async () => {
    const fake = fakeGateway({
      read: { kind: "unavailable", error: { status: 503 } },
    });

    const decision = await signOutAuthSession(fake.gateway, "global");

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(decision.clearLocal).toBe(false);
    expect(fake.scopes).toEqual(["global"]);
  });

  it("recovers when revoke succeeded but the follow-up read throws", async () => {
    const fake = fakeGateway({
      readError: new TypeError(`Failed to fetch ${leakedEmail}`),
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
    expect(decision.clearLocal).toBe(false);
  });

  it("recovers when the read after revoke throws", async () => {
    const fake = fakeGateway({
      readError: { status: 503, message: leakedEmail },
      revokeError: new TypeError("Failed to fetch"),
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
  });

  it("uses the revoke error when a principal remains", async () => {
    const fake = fakeGateway({
      readSequence: [
        principalRead(currentPrincipal),
        principalRead(currentPrincipal),
      ],
      revokeError: new TypeError(`Failed to fetch ${leakedEmail}`),
    });

    const decision = await signOutAuthSession(fake.gateway, "local");

    expect(decision.snapshot).toMatchObject({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(decision)).not.toContain(leakedEmail);
  });
});

function fakeGateway(input: {
  readonly read?: PersistedSessionRead;
  readonly readSequence?: readonly PersistedSessionRead[];
  readonly readImpl?: () => Promise<PersistedSessionRead>;
  readonly readError?: unknown;
  readonly refresh?: PersistedSessionRead;
  readonly refreshError?: unknown;
  readonly revokeError?: unknown;
  readonly clearError?: unknown;
}): {
  readonly gateway: AuthSessionGateway;
  clears: number;
  refreshes: number;
  readonly scopes: string[];
} {
  const state = {
    clears: 0,
    refreshes: 0,
    scopes: [] as string[],
    reads: [...(input.readSequence ?? [])],
  };
  const gateway: AuthSessionGateway = {
    async readPersisted() {
      if (input.readError !== undefined && state.reads.length === 0) {
        throw input.readError;
      }
      if (input.readImpl !== undefined) {
        return input.readImpl();
      }
      const next = state.reads.shift();
      if (next !== undefined) {
        return next;
      }
      if (input.read !== undefined) {
        return input.read;
      }
      return { kind: "none" };
    },
    async refresh() {
      state.refreshes += 1;
      if (input.refreshError !== undefined) {
        throw input.refreshError;
      }
      if (input.refresh !== undefined) {
        return input.refresh;
      }
      return { kind: "none" };
    },
    async revoke(scope) {
      state.scopes.push(scope);
      if (input.revokeError !== undefined) {
        throw input.revokeError;
      }
    },
    async clearLocal() {
      state.clears += 1;
      if (input.clearError !== undefined) {
        throw input.clearError;
      }
    },
  };

  return {
    gateway,
    get clears() {
      return state.clears;
    },
    get refreshes() {
      return state.refreshes;
    },
    scopes: state.scopes,
  };
}
