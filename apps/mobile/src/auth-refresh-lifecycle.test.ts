import {
  bindMobileAuthRefreshLifecycle,
  resetMobileAuthRefreshLifecycleForTests,
  type MobileAppState,
  type MobileAuthRefreshClient,
} from "./auth-refresh-lifecycle";

describe("mobile auth refresh lifecycle", () => {
  afterEach(() => {
    resetMobileAuthRefreshLifecycleForTests();
  });

  it("runs refresh only while the app is active", async () => {
    const appState = fakeAppState("active");
    const client = fakeClient();

    bindMobileAuthRefreshLifecycle({ appState, client: client.client });
    await flush();
    appState.emit("active");
    appState.emit("background");
    appState.emit("inactive");
    appState.emit("active");
    appState.emit("background");
    appState.emit("active");
    await flush();

    expect(client.starts).toBe(3);
    expect(client.stops).toBe(3);
  });

  it("replaces a previous listener and stops the previous client", async () => {
    const appState = fakeAppState("active");
    const first = fakeClient();
    const second = fakeClient();

    bindMobileAuthRefreshLifecycle({ appState, client: first.client });
    bindMobileAuthRefreshLifecycle({ appState, client: second.client });
    await flush();
    appState.emit("background");
    await flush();

    expect(first.stops).toBe(1);
    expect(second.starts).toBe(1);
    expect(second.stops).toBe(1);
    expect(first.starts).toBe(1);
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function fakeAppState(initial: string): MobileAppState & {
  emit(state: string): void;
} {
  let current = initial;
  const listeners: Array<(state: string) => void> = [];
  return {
    get currentState() {
      return current;
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
      return {
        remove() {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        },
      };
    },
    emit(state) {
      current = state;
      for (const listener of [...listeners]) {
        listener(state);
      }
    },
  };
}

function fakeClient(): {
  client: MobileAuthRefreshClient;
  starts: number;
  stops: number;
} {
  const state = { starts: 0, stops: 0 };
  return {
    get starts() {
      return state.starts;
    },
    get stops() {
      return state.stops;
    },
    client: {
      auth: {
        async startAutoRefresh() {
          state.starts += 1;
        },
        async stopAutoRefresh() {
          state.stops += 1;
        },
      },
    },
  };
}
