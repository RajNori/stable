import {
  pushTokenStorageKey,
  refreshPushRegistration,
  removePushRegistration,
  requestPushRegistration,
  type MobilePushPlatform,
  type PushRegistrationApi,
  type PushTokenStorage,
} from "./push-registration";

function testStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: PushTokenStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  return { storage, values };
}

function pushApi(input?: {
  status?: "granted" | "denied" | "undetermined";
  requestedStatus?: "granted" | "denied" | "undetermined";
  token?: string;
}) {
  const calls: string[] = [];
  const api: PushRegistrationApi = {
    async getPermissionsAsync() {
      calls.push("get-permissions");
      return { status: input?.status ?? "granted" };
    },
    async requestPermissionsAsync() {
      calls.push("request-permissions");
      return { status: input?.requestedStatus ?? "granted" };
    },
    async getExpoPushTokenAsync({ projectId }) {
      calls.push(`get-token:${projectId}`);
      return { data: input?.token ?? "ExpoPushToken[new]" };
    },
  };
  return { api, calls };
}

function registrationPorts(calls: string[]) {
  return {
    registerDevice: async (token: string, platform: MobilePushPlatform) => {
      calls.push(`register:${platform}:${token}`);
    },
    removeDevice: async (token: string) => {
      calls.push(`remove:${token}`);
    },
  };
}

describe("mobile push registration", () => {
  it("does not prompt or request a token without an EAS project id", async () => {
    const { api, calls } = pushApi();
    const { storage } = testStorage();
    const ports = registrationPorts(calls);

    const result = await requestPushRegistration({
      api,
      storage,
      userId: "user-1",
      projectId: null,
      platform: "IOS",
      ...ports,
    });
    expect(result).toEqual({ status: "configuration-required" });
    expect(calls).toEqual([]);
  });

  it("asks only after user action, registers the Expo token, and stores it per adult", async () => {
    const { api, calls } = pushApi({ status: "undetermined" });
    const { storage, values } = testStorage();
    const ports = registrationPorts(calls);

    const result = await requestPushRegistration({
      api,
      storage,
      userId: "adult-1",
      projectId: "project-uuid",
      platform: "IOS",
      ...ports,
    });
    expect(result).toEqual({ status: "registered" });
    expect(calls).toEqual([
      "get-permissions",
      "request-permissions",
      "get-token:project-uuid",
      "register:IOS:ExpoPushToken[new]",
    ]);
    expect(values.get(pushTokenStorageKey("adult-1"))).toBe(
      "ExpoPushToken[new]",
    );
    expect(values.has(pushTokenStorageKey("adult-2"))).toBe(false);
  });

  it("removes the previous endpoint before storing a rotated token", async () => {
    const { api, calls } = pushApi({ token: "ExpoPushToken[rotated]" });
    const key = pushTokenStorageKey("adult-1");
    const { storage, values } = testStorage({
      [key]: "ExpoPushToken[old]",
    });
    const ports = registrationPorts(calls);

    await refreshPushRegistration({
      api,
      storage,
      userId: "adult-1",
      projectId: "project-uuid",
      platform: "ANDROID",
      ...ports,
    });

    expect(calls).toEqual([
      "get-permissions",
      "get-token:project-uuid",
      "remove:ExpoPushToken[old]",
      "register:ANDROID:ExpoPushToken[rotated]",
    ]);
    expect(values.get(key)).toBe("ExpoPushToken[rotated]");
  });

  it("revokes a stored endpoint when permission is no longer granted", async () => {
    const { api, calls } = pushApi({ status: "denied" });
    const key = pushTokenStorageKey("adult-1");
    const { storage, values } = testStorage({
      [key]: "ExpoPushToken[old]",
    });
    const ports = registrationPorts(calls);

    const result = await refreshPushRegistration({
      api,
      storage,
      userId: "adult-1",
      projectId: "project-uuid",
      platform: "IOS",
      ...ports,
    });
    expect(result).toEqual({ status: "permission-denied" });
    expect(calls).toEqual(["get-permissions", "remove:ExpoPushToken[old]"]);
    expect(values.has(key)).toBe(false);
  });

  it("keeps the secure token if server-side endpoint removal fails", async () => {
    const key = pushTokenStorageKey("adult-1");
    const { storage, values } = testStorage({
      [key]: "ExpoPushToken[current]",
    });
    await expect(
      removePushRegistration({
        storage,
        userId: "adult-1",
        removeDevice: async () => {
          throw new Error("private rpc response");
        },
      }),
    ).rejects.toThrow("private rpc response");
    expect(values.get(key)).toBe("ExpoPushToken[current]");
  });

  it("reports missing local token state as unresolved cleanup", async () => {
    const { storage } = testStorage();
    let removeCalls = 0;

    const removed = await removePushRegistration({
      storage,
      userId: "adult-1",
      removeDevice: async () => {
        removeCalls += 1;
      },
    });
    expect(removed).toBe(false);
    expect(removeCalls).toBe(0);
  });

  it("recovers the current device token when SecureStore state is missing", async () => {
    const { storage } = testStorage();
    const calls: string[] = [];

    const removed = await removePushRegistration({
      storage,
      userId: "adult-1",
      recoverToken: async () => "ExpoPushToken[recovered]",
      removeDevice: async (token) => {
        calls.push(token);
      },
    });

    expect(removed).toBe(true);
    expect(calls).toEqual(["ExpoPushToken[recovered]"]);
  });
});
