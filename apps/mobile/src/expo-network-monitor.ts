import * as Network from "expo-network";

import type { NetworkMonitor } from "./mobile-connectivity";

export function expoNetworkMonitor(): NetworkMonitor {
  return {
    getNetworkState: () => Network.getNetworkStateAsync(),
    addNetworkStateListener: (listener) =>
      Network.addNetworkStateListener(listener),
  };
}
