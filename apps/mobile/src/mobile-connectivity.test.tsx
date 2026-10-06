import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  onlineFromNetworkState,
  useMobileOnline,
  type NetworkMonitor,
  type NetworkState,
} from "./mobile-connectivity";

function connectionLabel(online: boolean | null): string {
  if (online === null) {
    return "unknown";
  }
  if (online) {
    return "online";
  }
  return "offline";
}

function Probe({ monitor }: { monitor: NetworkMonitor }) {
  const online = useMobileOnline(monitor);
  return <Text>{connectionLabel(online)}</Text>;
}

describe("mobile connectivity", () => {
  it("treats an unknown radio as unresolved, a dead link as offline, and a reachable link as online", () => {
    expect(onlineFromNetworkState({})).toBeNull();
    expect(onlineFromNetworkState({ isConnected: false })).toBe(false);
    expect(
      onlineFromNetworkState({
        isConnected: true,
        isInternetReachable: false,
      }),
    ).toBe(false);
    expect(
      onlineFromNetworkState({
        isConnected: true,
        isInternetReachable: true,
      }),
    ).toBe(true);
  });

  it("follows connectivity changes without a synchronization framework", async () => {
    let current: NetworkState = {
      isConnected: false,
      isInternetReachable: false,
    };
    let listener: ((state: NetworkState) => void) | undefined;
    const monitor: NetworkMonitor = {
      getNetworkState: () => Promise.resolve(current),
      addNetworkStateListener: (next) => {
        listener = next;
        return { remove: () => undefined };
      },
    };

    await render(<Probe monitor={monitor} />);
    expect(await screen.findByText("offline")).toBeTruthy();
    current = { isConnected: true, isInternetReachable: true };
    const notify = listener;
    if (notify === undefined) {
      throw new Error("missing listener");
    }
    await act(() => {
      notify(current);
    });
    expect(await screen.findByText("online")).toBeTruthy();
  });
});
