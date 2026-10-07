import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  deactivateDevice,
  enqueueAnnouncementPublished,
  registerDevice,
  setNotificationPreference,
  type NotificationWriter,
} from "./notification-commands.js";

const principal: Principal = {
  userId: "19191919-1919-4919-8919-191919191919",
  displayName: "Manager",
};

function writer(): NotificationWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    registerDevice: (input) => {
      calls.push(`register:${input.token}`);
      return Promise.resolve({
        endpointId: "55555555-5555-4555-8555-555555555555",
      });
    },
    deactivateDevice: (token) => {
      calls.push(`deactivate:${token}`);
      return Promise.resolve();
    },
    setPreference: (input) => {
      calls.push(`preference:${input.category}:${String(input.pushEnabled)}`);
      return Promise.resolve();
    },
    listPreferences: () => Promise.resolve([]),
    enqueueAnnouncementPublished: () => {
      calls.push("enqueue");
      return Promise.resolve(2);
    },
  };
}

describe("notification commands", () => {
  it("registers and removes only the presented device", async () => {
    const calls = writer();
    const registered = await registerDevice({
      principal,
      token: "ExponentPushToken[phone]",
      platform: "IOS",
      writer: calls,
    });
    expect(registered.endpointId).toBe("55555555-5555-4555-8555-555555555555");
    await deactivateDevice({
      principal,
      token: "ExponentPushToken[phone]",
      writer: calls,
    });
    await setNotificationPreference({
      principal,
      category: "ANNOUNCEMENT_PUBLISHED",
      pushEnabled: false,
      writer: calls,
    });
    await expect(
      enqueueAnnouncementPublished({
        principal,
        announcementId: "55555555-5555-4555-8555-555555555555",
        writer: calls,
      }),
    ).resolves.toBe(2);
    expect(calls.calls).toEqual([
      "register:ExponentPushToken[phone]",
      "deactivate:ExponentPushToken[phone]",
      "preference:ANNOUNCEMENT_PUBLISHED:false",
      "enqueue",
    ]);
  });

  it("rejects a signed-out caller and a control character before writing", async () => {
    const calls = writer();
    await expect(
      registerDevice({
        principal: null,
        token: "ExponentPushToken[phone]",
        platform: "IOS",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      registerDevice({
        principal,
        token: "Bad\u0000token",
        platform: "IOS",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      deactivateDevice({ principal, token: " ", writer: calls }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      setNotificationPreference({
        principal,
        category: "ALL_USERS",
        pushEnabled: true,
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      enqueueAnnouncementPublished({
        principal,
        announcementId: "not-an-id",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(calls.calls).toEqual([]);
  });
});
