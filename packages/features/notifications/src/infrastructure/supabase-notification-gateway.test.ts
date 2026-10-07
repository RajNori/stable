import { describe, expect, it } from "vitest";

import { createSupabaseNotificationGateway } from "./supabase-notification-gateway.js";

const endpointId = "55555555-5555-4555-8555-555555555555";

function client(result: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: () => Promise.resolve(result),
  };
}

describe("notification gateway", () => {
  it("registers a device and lists preferences", async () => {
    const gateway = createSupabaseNotificationGateway(
      client({ data: endpointId, error: null }),
    );
    await expect(
      gateway.registerDevice({
        token: "ExponentPushToken[phone]",
        platform: "WEB",
      }),
    ).resolves.toEqual({ endpointId });
    await expect(
      gateway.deactivateDevice("ExponentPushToken[phone]"),
    ).resolves.toBeUndefined();
    await expect(
      gateway.setPreference({
        category: "ANNOUNCEMENT_PUBLISHED",
        pushEnabled: true,
      }),
    ).resolves.toBeUndefined();

    const listed = createSupabaseNotificationGateway(
      client({
        data: [{ category: "ANNOUNCEMENT_PUBLISHED", push_enabled: false }],
        error: null,
      }),
    );
    await expect(listed.listPreferences()).resolves.toEqual([
      { category: "ANNOUNCEMENT_PUBLISHED", pushEnabled: false },
    ]);

    const empty = createSupabaseNotificationGateway(
      client({ data: null, error: null }),
    );
    await expect(empty.listPreferences()).resolves.toEqual([]);
    await expect(
      empty.enqueueAnnouncementPublished(endpointId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("maps stable database errors", async () => {
    const codes = [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_FAILED",
      "CONFLICT",
      "42501: FORBIDDEN",
      "NOPE",
    ] as const;
    for (const message of codes) {
      const gateway = createSupabaseNotificationGateway(
        client({ data: null, error: { message } }),
      );
      await expect(
        gateway.deactivateDevice("ExponentPushToken[phone]"),
      ).rejects.toMatchObject({
        code: message.endsWith("FORBIDDEN")
          ? "FORBIDDEN"
          : message === "NOPE"
            ? "INTERNAL"
            : message,
      });
    }

    const broken = createSupabaseNotificationGateway(
      client({ data: [{ category: "NOPE" }], error: null }),
    );
    await expect(broken.listPreferences()).rejects.toMatchObject({
      code: "INTERNAL",
    });
    const badId = createSupabaseNotificationGateway(
      client({ data: "not-a-uuid", error: null }),
    );
    await expect(
      badId.registerDevice({
        token: "ExponentPushToken[phone]",
        platform: "IOS",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
