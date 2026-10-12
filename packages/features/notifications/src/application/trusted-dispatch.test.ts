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
    };
    const invalid: NotificationReceiptClaim = {
      providerReceiptId: "receipt-invalid",
      endpointId: "endpoint-opaque",
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
});
