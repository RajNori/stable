import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { useEffect } from "react";

import {
  resumePushRegistration,
  withPushRegistrationAdmission,
  type PendingPushCleanupStore,
} from "./auth/pending-push-cleanup";
import {
  registerMobileDevice,
  removeMobileDevice,
  removeMobileDeviceForSession,
} from "./load-mobile-notifications";
import {
  refreshPushRegistration,
  removePushRegistration,
  requestPushRegistration,
  type MobilePushPlatform,
  type PushRegistrationResult,
  type PushTokenStorage,
} from "./push-registration";

const secureTokenStorage: PushTokenStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

function projectId(): string | null {
  const value =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function platform(): MobilePushPlatform | null {
  if (Platform.OS === "ios") return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  return null;
}

async function recoverCurrentExpoPushToken(): Promise<string | null> {
  const selectedProjectId = projectId();
  if (selectedProjectId === null) return null;
  return (
    await Notifications.getExpoPushTokenAsync({ projectId: selectedProjectId })
  ).data;
}

function environment(userId: string) {
  const selectedPlatform = platform();
  if (selectedPlatform === null) return null;
  return {
    api: Notifications,
    storage: secureTokenStorage,
    userId,
    projectId: projectId(),
    platform: selectedPlatform,
    registerDevice: registerMobileDevice,
    removeDevice: removeMobileDevice,
  };
}

export async function requestLivePushRegistration(
  userId: string,
  store: PendingPushCleanupStore,
): Promise<PushRegistrationResult> {
  const input = environment(userId);
  if (input === null) return { status: "configuration-required" };
  const result = await withPushRegistrationAdmission({
    store,
    userId,
    operation: (canContinue) =>
      requestPushRegistration({ ...input, canContinue }),
    shouldClearFence: (value) => value.status !== "cleanup-pending",
  });
  return result.admitted ? result.value : { status: "cleanup-pending" };
}

export async function refreshLivePushRegistration(
  userId: string,
  store: PendingPushCleanupStore,
): Promise<PushRegistrationResult> {
  const input = environment(userId);
  if (input === null) return { status: "configuration-required" };
  const result = await withPushRegistrationAdmission({
    store,
    userId,
    operation: (canContinue) =>
      refreshPushRegistration({ ...input, canContinue }),
    shouldClearFence: (value) => value.status !== "cleanup-pending",
  });
  return result.admitted ? result.value : { status: "cleanup-pending" };
}

export async function removeLivePushRegistration(
  userId: string,
): Promise<boolean> {
  return removePushRegistration({
    storage: secureTokenStorage,
    userId,
    removeDevice: removeMobileDevice,
    recoverToken: recoverCurrentExpoPushToken,
  });
}

export async function removeLivePushRegistrationForSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
): Promise<boolean> {
  return removePushRegistration({
    storage: secureTokenStorage,
    userId,
    removeDevice: (token) =>
      removeMobileDeviceForSession(token, { accessToken, refreshToken }),
    recoverToken: recoverCurrentExpoPushToken,
  });
}

export function MobilePushRegistrationLifecycle({
  userId,
  store,
}: {
  userId: string;
  store: PendingPushCleanupStore;
}) {
  useEffect(() => {
    let active = true;
    resumePushRegistration(userId);
    const refresh = (): void => {
      void refreshLivePushRegistration(userId, store).catch(() => undefined);
    };
    refresh();
    const tokenSubscription = Notifications.addPushTokenListener(refresh);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (active && state === "active") refresh();
      },
    );
    return () => {
      active = false;
      tokenSubscription.remove();
      appStateSubscription.remove();
    };
  }, [store, userId]);
  return null;
}
