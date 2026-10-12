import { describe, expect, it, vi } from "vitest";

import { createExpoProvider, type FetchLike } from "./expo-provider.js";

describe("Expo push provider adapter", () => {
  it("sends only the generic caller-provided payload and returns the receipt id", async () => {
    const fetcher = vi.fn<FetchLike>(async () => ({
      ok: true,
      json: async () => ({ data: { status: "ok", id: "receipt-1" } }),
    }));
    const provider = createExpoProvider(fetcher);

    const result = await provider.send({
      to: "ExponentPushToken[private]",
      title: "The Stable",
      body: "A team update is available.",
      sound: "default",
      data: {
        requestId: "request-opaque",
        notificationType: "ANNOUNCEMENT_PUBLISHED",
      },
    });

    expect(result).toEqual({ status: "ok", id: "receipt-1" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body ?? "null") as {
      body: string;
      data: Record<string, string>;
    };
    expect(body.body).toBe("A team update is available.");
    expect(body.data).toEqual({
      requestId: "request-opaque",
      notificationType: "ANNOUNCEMENT_PUBLISHED",
    });
  });

  it("preserves only allowlisted invalid-device errors from Expo", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          status: "error",
          message: "private token should not escape",
          details: { error: "DeviceNotRegistered" },
        },
      }),
    }));

    const result = await createExpoProvider(fetcher).send({
      to: "ExponentPushToken[private]",
      title: "The Stable",
      body: "A team update is available.",
      sound: "default",
      data: { requestId: "r", notificationType: "ANNOUNCEMENT_PUBLISHED" },
    });

    expect(result).toEqual({
      status: "error",
      errorCode: "DeviceNotRegistered",
    });
    expect(JSON.stringify(result)).not.toContain("private token");
  });

  it("keeps receipts that have not arrived pending and sanitizes receipt errors", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          ready: { status: "ok" },
          invalid: {
            status: "error",
            message: "do not propagate provider message",
            details: { error: "DeviceNotRegistered" },
          },
          ignored: {
            status: "error",
            details: { error: "UnknownProviderInternals" },
          },
        },
      }),
    }));

    const receipts = await createExpoProvider(fetcher).getReceipts([
      "ready",
      "invalid",
      "missing",
    ]);

    expect(receipts).toEqual({
      ready: { status: "ok" },
      invalid: { status: "error", errorCode: "DeviceNotRegistered" },
      ignored: { status: "error" },
    });
    expect(JSON.stringify(receipts)).not.toContain("provider message");
  });
});
