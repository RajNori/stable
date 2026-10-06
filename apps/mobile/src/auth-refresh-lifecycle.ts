/**
 * One AppState subscription for the mobile Supabase client's auth refresh.
 *
 * React Native is not a browser, so GoTrue would otherwise run its refresh
 * ticker continuously. This binding starts that ticker only while the app is
 * active and stops it for background and inactive. A second bind, including
 * Fast Refresh or a repeated effect, replaces the previous listener and stops
 * the previous client before starting the next one.
 */

const SLOT = Symbol.for("stable.mobileAuthRefresh");

export type MobileAuthRefreshClient = {
  auth: {
    startAutoRefresh(): Promise<void>;
    stopAutoRefresh(): Promise<void>;
  };
};

export type MobileAppState = {
  currentState: string;
  addEventListener(
    type: "change",
    listener: (state: string) => void,
  ): { remove(): void };
};

type RefreshBinding = {
  readonly client: MobileAuthRefreshClient;
  readonly remove: () => void;
};

function bindingSlot(): RefreshBinding | undefined {
  const holder = globalThis as typeof globalThis & {
    [SLOT]?: RefreshBinding;
  };
  return holder[SLOT];
}

function setBinding(binding: RefreshBinding | undefined): void {
  const holder = globalThis as typeof globalThis & {
    [SLOT]?: RefreshBinding;
  };
  if (binding === undefined) {
    delete holder[SLOT];
    return;
  }
  holder[SLOT] = binding;
}

export function bindMobileAuthRefreshLifecycle(input: {
  readonly appState: MobileAppState;
  readonly client: MobileAuthRefreshClient;
}): void {
  const previous = bindingSlot();
  if (previous !== undefined) {
    previous.remove();
    void previous.client.auth.stopAutoRefresh();
  }

  let applied: string | null = null;
  const apply = (state: string): void => {
    if (state === applied) {
      return;
    }
    applied = state;
    if (state === "active") {
      void input.client.auth.startAutoRefresh();
      return;
    }
    void input.client.auth.stopAutoRefresh();
  };

  const subscription = input.appState.addEventListener("change", apply);
  setBinding({
    client: input.client,
    remove() {
      subscription.remove();
    },
  });
  apply(input.appState.currentState);
}

export function resetMobileAuthRefreshLifecycleForTests(): void {
  const previous = bindingSlot();
  if (previous !== undefined) {
    previous.remove();
    void previous.client.auth.stopAutoRefresh();
  }
  setBinding(undefined);
}
