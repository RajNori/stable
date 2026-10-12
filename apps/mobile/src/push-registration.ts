export type PushPermissionStatus = "granted" | "denied" | "undetermined";

export type PushRegistrationApi = {
  getPermissionsAsync(): Promise<{ status: PushPermissionStatus }>;
  requestPermissionsAsync(): Promise<{ status: PushPermissionStatus }>;
  getExpoPushTokenAsync(input: {
    projectId: string;
  }): Promise<{ data: string }>;
};

export type PushTokenStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type PushRegistrationResult =
  | { status: "registered" }
  | { status: "permission-denied" }
  | { status: "configuration-required" };

export type MobilePushPlatform = "IOS" | "ANDROID";

export function pushTokenStorageKey(userId: string): string {
  return `stable-expo-push-token:${userId}`;
}

async function registerGrantedPushPermission(input: {
  api: PushRegistrationApi;
  storage: PushTokenStorage;
  userId: string;
  projectId: string | null;
  platform: MobilePushPlatform;
  registerDevice: (
    token: string,
    platform: MobilePushPlatform,
  ) => Promise<void>;
  removeDevice: (token: string) => Promise<void>;
}): Promise<PushRegistrationResult> {
  if (input.projectId === null || input.projectId.length === 0) {
    return { status: "configuration-required" };
  }

  const token = (
    await input.api.getExpoPushTokenAsync({
      projectId: input.projectId,
    })
  ).data;
  const tokenKey = pushTokenStorageKey(input.userId);
  const previousToken = await input.storage.getItem(tokenKey);

  if (previousToken !== null && previousToken !== token) {
    await input.removeDevice(previousToken);
  }
  await input.registerDevice(token, input.platform);
  await input.storage.setItem(tokenKey, token);
  return { status: "registered" };
}

export async function refreshPushRegistration(input: {
  api: PushRegistrationApi;
  storage: PushTokenStorage;
  userId: string;
  projectId: string | null;
  platform: MobilePushPlatform;
  registerDevice: (
    token: string,
    platform: MobilePushPlatform,
  ) => Promise<void>;
  removeDevice: (token: string) => Promise<void>;
}): Promise<PushRegistrationResult> {
  if (input.projectId === null || input.projectId.length === 0) {
    return { status: "configuration-required" };
  }
  const permissions = await input.api.getPermissionsAsync();
  if (permissions.status !== "granted") {
    await removePushRegistration(input);
    return { status: "permission-denied" };
  }
  return registerGrantedPushPermission(input);
}

export async function requestPushRegistration(input: {
  api: PushRegistrationApi;
  storage: PushTokenStorage;
  userId: string;
  projectId: string | null;
  platform: MobilePushPlatform;
  registerDevice: (
    token: string,
    platform: MobilePushPlatform,
  ) => Promise<void>;
  removeDevice: (token: string) => Promise<void>;
}): Promise<PushRegistrationResult> {
  if (input.projectId === null || input.projectId.length === 0) {
    return { status: "configuration-required" };
  }
  const permissions = await input.api.getPermissionsAsync();
  const finalPermissions =
    permissions.status === "granted"
      ? permissions
      : await input.api.requestPermissionsAsync();
  if (finalPermissions.status !== "granted") {
    await removePushRegistration(input);
    return { status: "permission-denied" };
  }
  return registerGrantedPushPermission(input);
}

export async function removePushRegistration(input: {
  storage: PushTokenStorage;
  userId: string;
  removeDevice: (token: string) => Promise<void>;
}): Promise<boolean> {
  const key = pushTokenStorageKey(input.userId);
  const token = await input.storage.getItem(key);
  // The server may still have an active endpoint if this local SecureStore
  // entry was lost. Callers enforcing account-switch cleanup must distinguish
  // that unknown state from a successful revocation and keep their fence.
  if (token === null) return false;

  await input.removeDevice(token);
  await input.storage.removeItem(key);
  return true;
}
