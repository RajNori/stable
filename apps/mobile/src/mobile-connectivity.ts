import { useEffect, useState } from "react";

export type NetworkState = {
  isConnected?: boolean;
  isInternetReachable?: boolean;
};

export type NetworkMonitor = {
  getNetworkState(): Promise<NetworkState>;
  addNetworkStateListener(listener: (state: NetworkState) => void): {
    remove(): void;
  };
};

export function onlineFromNetworkState(state: NetworkState): boolean | null {
  if (state.isConnected === undefined) {
    return null;
  }
  if (state.isConnected !== true) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
}

export function useMobileOnline(monitor: NetworkMonitor): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const apply = (state: NetworkState): void => {
      const next = onlineFromNetworkState(state);
      if (active && next !== null) {
        setOnline(next);
      }
    };
    monitor
      .getNetworkState()
      .then(apply)
      .catch(() => {
        if (active) {
          setOnline(true);
        }
      });
    const subscription = monitor.addNetworkStateListener(apply);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [monitor]);

  return online;
}
