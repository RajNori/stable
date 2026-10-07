import { describe, expect, it } from "vitest";

import {
  announcementPushData,
  createFakeExpoPushPort,
  deliverQueuedNotification,
  type DeliveryPlan,
} from "./deliver-notification.js";

const message: DeliveryPlan["message"] = {
  to: "unused",
  data: announcementPushData({
    teamId: "99999999-9999-4999-8999-999999999999",
    announcementId: "55555555-5555-4555-8555-555555555555",
    category: "DUTY",
  }),
};

function plan(overrides: Partial<DeliveryPlan> = {}): DeliveryPlan {
  return {
    eligible: true,
    preferenceEnabled: true,
    alreadyDelivered: false,
    devices: [
      { token: "ExponentPushToken[a]", active: true },
      { token: "ExponentPushToken[b]", active: true },
    ],
    message,
    ...overrides,
  };
}

describe("notification delivery", () => {
  it("sends once and deactivates an invalid token", async () => {
    const port = createFakeExpoPushPort({
      results: {
        "ExponentPushToken[a]": "INVALID",
        "ExponentPushToken[b]": "OK",
      },
    });
    const decision = await deliverQueuedNotification(
      plan({
        devices: [
          { token: "ExponentPushToken[a]", active: true },
          { token: "ExponentPushToken[b]", active: true },
          { token: "ExponentPushToken[c]", active: false },
        ],
      }),
      port,
    );
    expect(decision.status).toBe("SENT");
    expect(decision.deactivateTokens).toEqual(["ExponentPushToken[a]"]);
    expect(port.sent).toHaveLength(2);
    expect(Object.keys(port.sent[0]?.data ?? {}).sort()).toEqual([
      "announcementId",
      "category",
      "notificationType",
      "teamId",
    ]);
  });

  it("does not call the provider when the recipient is revoked or opted out", async () => {
    const port = createFakeExpoPushPort({ results: {} });
    await expect(
      deliverQueuedNotification(plan({ eligible: false }), port),
    ).resolves.toMatchObject({ status: "SKIPPED" });
    await expect(
      deliverQueuedNotification(plan({ preferenceEnabled: false }), port),
    ).resolves.toMatchObject({ status: "SKIPPED" });
    await expect(
      deliverQueuedNotification(plan({ alreadyDelivered: true }), port),
    ).resolves.toMatchObject({ status: "SENT" });
    await expect(
      deliverQueuedNotification(plan({ devices: [] }), port),
    ).resolves.toMatchObject({ status: "SKIPPED" });
    expect(port.sent).toHaveLength(0);
  });

  it("fails when every active device is rejected", async () => {
    const port = createFakeExpoPushPort({
      results: {
        "ExponentPushToken[a]": "INVALID",
        "ExponentPushToken[b]": "ERROR",
      },
    });
    const decision = await deliverQueuedNotification(plan(), port);
    expect(decision.status).toBe("FAILED");
    expect(decision.deactivateTokens).toEqual(["ExponentPushToken[a]"]);
  });
});
