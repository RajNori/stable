import { describe, expect, it, vi } from "vitest";

import {
  collectNotificationReceipts,
  createPrivacySafeExpoMessage,
  dispatchNotificationBatch,
  type NotificationDispatchClaim,
  type NotificationDispatchTarget,
  type NotificationReceiptClaim,
  type TrustedNotificationDispatchStore,
} from "./trusted-dispatch.js";

const claim: NotificationDispatchClaim = {
  requestId: "request-opaque",
  claimId: "claim-opaque",
  notificationType: "ANNOUNCEMENT_PUBLISHED",
};

const target: NotificationDispatchTarget = {
  endpointId: "endpoint-opaque",
  pushToken: "ExponentPushToken[private]",
  notificationType: "ANNOUNCEMENT_PUBLISHED",
};

function dispatchStore(
  overrides: Partial<TrustedNotificationDispatchStore> = {},
) {
  return {
    claimDispatches: vi.fn(async () => [claim]),
    beginDispatch: vi.fn(async () => target),
    applyDispatchResult: vi.fn(async () => "SENT"),
    claimReceipts: vi.fn(async () => []),
    applyReceipt: vi.fn(async () => "OK"),
    ...overrides,
  } satisfies TrustedNotificationDispatchStore;
}

describe("trusted notification dispatch", () => {
  it.each([
    ["ANNOUNCEMENT_PUBLISHED", "A team update is available."],
    ["DUTY_ASSIGNED", "There is an update to a team duty."],
    ["DUTY_SWAP_REQUESTED", "There is an update to a team duty."],
    ["DUTY_SWAP_ACCEPTED", "There is an update to a team duty."],
    ["FILL_IN_REQUESTED", "A fill-in opportunity is available."],
    ["FILL_IN_CONFIRMED", "A fill-in response was confirmed."],
    ["TRAINING_CHANGED", "There is an update to a team training session."],
    ["TRAINING_CANCELLED", "There is an update to a team training session."],
    ["COACH_CHECKED_IN", "A coach checked in."],
    ["FIXTURE_CHANGED", "There is an update to a team event."],
    ["GAME_REMINDER", "There is an update to a team event."],
    ["RSVP_REQUIRED", "There is an update to a team event."],
    ["UNRECOGNIZED", "There is an update to a team event."],
  ])("uses safe copy for %s", (notificationType, body) => {
    expect(
      createPrivacySafeExpoMessage({
        requestId: "opaque",
        notificationType,
        pushToken: "token",
      }).body,
    ).toBe(body);
  });

  it("sends generic content with only opaque routing data", () => {
    const message = createPrivacySafeExpoMessage({
      requestId: "request-opaque",
      notificationType: "ANNOUNCEMENT_PUBLISHED",
      pushToken: "ExponentPushToken[private]",
    });

    expect(message).toEqual({
      to: "ExponentPushToken[private]",
      title: "The Stable",
      body: "A team update is available.",
      sound: "default",
      data: {
        requestId: "request-opaque",
        notificationType: "ANNOUNCEMENT_PUBLISHED",
      },
    });
    expect(JSON.stringify(message)).not.toMatch(
      /child|player|guardian|private note/i,
    );
  });

  it("rechecks the claim before sending and persists the provider receipt id", async () => {
    const store = dispatchStore();
    const send = vi.fn(async () => ({
      status: "ok" as const,
      id: "receipt-1",
    }));

    const summary = await dispatchNotificationBatch(store, send);

    expect(store.beginDispatch).toHaveBeenCalledWith(claim);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: target.pushToken }),
    );
    expect(store.applyDispatchResult).toHaveBeenCalledWith({
      claim,
      target,
      result: "OK",
      providerReceiptId: "receipt-1",
    });
    expect(summary).toEqual({
      claimed: 1,
      attempted: 1,
      sent: 1,
      pending: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("does not call Expo when the authoritative begin check denies the claim", async () => {
    const store = dispatchStore({
      beginDispatch: vi.fn(async () => null),
    });
    const send = vi.fn();

    const summary = await dispatchNotificationBatch(store, send);

    expect(send).not.toHaveBeenCalled();
    expect(store.applyDispatchResult).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  it("returns an empty summary when there are no pending claims", async () => {
    const store = dispatchStore({
      claimDispatches: vi.fn(async () => []),
    });

    await expect(dispatchNotificationBatch(store, vi.fn())).resolves.toEqual({
      claimed: 0,
      attempted: 0,
      sent: 0,
      pending: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it.each([
    ["SKIPPED", { sent: 0, skipped: 1, failed: 0 }],
    ["FAILED", { sent: 0, skipped: 0, failed: 1 }],
  ])(
    "counts a successful provider ticket persisted as %s",
    async (state, counts) => {
      const store = dispatchStore({
        applyDispatchResult: vi.fn(async () => state),
      });

      const summary = await dispatchNotificationBatch(store, async () => ({
        status: "ok",
        id: "receipt",
      }));

      expect(summary).toMatchObject(counts);
    },
  );

  it.each([
    ["SKIPPED", { pending: 0, skipped: 1, failed: 0 }],
    ["FAILED", { pending: 0, skipped: 0, failed: 1 }],
  ])("counts an invalid endpoint persisted as %s", async (state, counts) => {
    const store = dispatchStore({
      applyDispatchResult: vi.fn(async () => state),
    });

    const summary = await dispatchNotificationBatch(store, async () => ({
      status: "error",
      errorCode: "DeviceNotRegistered",
    }));

    expect(summary).toMatchObject(counts);
  });

  it("counts a provider failure as failed and preserves its safe error code", async () => {
    const store = dispatchStore({
      applyDispatchResult: vi.fn(async () => "FAILED"),
    });

    await dispatchNotificationBatch(store, async () => ({
      status: "error",
      errorCode: "MessageTooBig",
    }));

    expect(store.applyDispatchResult).toHaveBeenCalledWith({
      claim,
      target,
      result: "ERROR",
      errorCode: "MessageTooBig",
    });
  });

  it("disables an invalid endpoint and leaves retryable work pending", async () => {
    const store = dispatchStore({
      applyDispatchResult: vi.fn(async () => "PENDING"),
    });

    const summary = await dispatchNotificationBatch(store, async () => ({
      status: "error",
      errorCode: "DeviceNotRegistered",
    }));

    expect(store.applyDispatchResult).toHaveBeenCalledWith({
      claim,
      target,
      result: "INVALID",
      errorCode: "DeviceNotRegistered",
    });
    expect(summary.pending).toBe(1);
  });

  it("does not retry an uncertain provider failure automatically", async () => {
    const store = dispatchStore({
      applyDispatchResult: vi.fn(async () => "FAILED"),
    });

    const summary = await dispatchNotificationBatch(store, async () => {
      throw new Error("response may contain provider details");
    });

    expect(store.applyDispatchResult).toHaveBeenCalledWith({
      claim,
      target,
      result: "ERROR",
    });
    expect(summary.failed).toBe(1);
  });

  it("leaves receipts pending until Expo returns them and records safe receipt errors", async () => {
    const pending: NotificationReceiptClaim = {
      providerReceiptId: "receipt-pending",
      endpointId: "endpoint-opaque",
      claimId: "claim-pending",
    };
    const invalid: NotificationReceiptClaim = {
      providerReceiptId: "receipt-invalid",
      endpointId: "endpoint-opaque",
      claimId: "claim-invalid",
    };
    const store = dispatchStore({
      claimReceipts: vi.fn(async () => [pending, invalid]),
    });

    const summary = await collectNotificationReceipts(store, async () => ({
      "receipt-invalid": {
        status: "error",
        errorCode: "DeviceNotRegistered",
      },
    }));

    expect(store.applyReceipt).toHaveBeenCalledExactlyOnceWith({
      receipt: invalid,
      status: "ERROR",
      errorCode: "DeviceNotRegistered",
    });
    expect(summary).toEqual({ claimed: 2, checked: 1, pending: 1, errors: 1 });
  });

  it("returns an empty receipt summary when no receipts are ready", async () => {
    const store = dispatchStore();

    await expect(collectNotificationReceipts(store, vi.fn())).resolves.toEqual({
      claimed: 0,
      checked: 0,
      pending: 0,
      errors: 0,
    });
  });

  it("records successful receipts without provider error text", async () => {
    const ready: NotificationReceiptClaim = {
      providerReceiptId: "receipt-ready",
      endpointId: "endpoint-opaque",
      claimId: "claim-ready",
    };
    const store = dispatchStore({
      claimReceipts: vi.fn(async () => [ready]),
    });

    const summary = await collectNotificationReceipts(store, async () => ({
      [ready.providerReceiptId]: { status: "ok" },
    }));

    expect(store.applyReceipt).toHaveBeenCalledExactlyOnceWith({
      receipt: ready,
      status: "OK",
    });
    expect(summary).toEqual({ claimed: 1, checked: 1, pending: 0, errors: 0 });
  });

  it("records provider receipt errors when no error code is supplied", async () => {
    const receipt: NotificationReceiptClaim = {
      providerReceiptId: "receipt-error",
      endpointId: "endpoint-opaque",
      claimId: "claim-error",
    };
    const store = dispatchStore({
      claimReceipts: vi.fn(async () => [receipt]),
    });

    const summary = await collectNotificationReceipts(store, async () => ({
      [receipt.providerReceiptId]: { status: "error" },
    }));

    expect(store.applyReceipt).toHaveBeenCalledExactlyOnceWith({
      receipt,
      status: "ERROR",
    });
    expect(summary.errors).toBe(1);
  });
});
