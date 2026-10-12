import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  authErrorCodeSchema,
  type AuthSessionSnapshot,
} from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthScreen } from "./auth-screen";

const theme = themeFor("mustangs");
const noopClearPrivateCache = (): void => undefined;

export type MobileLinking = {
  getInitialUrl: () => Promise<string | null>;
  subscribe: (listener: (url: string) => void) => () => void;
};

type GateActions = {
  requestPhone: (phone: string) => Promise<void>;
  verifyPhone: (phone: string, token: string) => Promise<AuthSessionSnapshot>;
  requestEmail: (email: string) => Promise<void>;
  validateCallback: (callbackUrl: string) => void;
  completeCallback: (callbackUrl: string) => Promise<AuthSessionSnapshot>;
};

type MobileAuthGateProps = {
  readonly restore: () => Promise<AuthSessionSnapshot>;
  readonly signOut: (userId: string) => Promise<AuthSessionSnapshot>;
  readonly actions: GateActions;
  readonly beforeCompleteCallback?:
    | (() => Promise<
        ((next: AuthSessionSnapshot) => Promise<void>) | undefined
      >)
    | undefined;
  readonly clearFailedCallbackSession?: (() => Promise<void>) | undefined;
  readonly linking?: MobileLinking;
  readonly clearPrivateCache?: (
    previousUserId: string | null,
  ) => void | Promise<void>;
  readonly authenticated: (userId: string) => React.ReactNode;
};

export function MobileAuthGate({
  restore,
  signOut,
  actions,
  beforeCompleteCallback,
  clearFailedCallbackSession,
  linking,
  clearPrivateCache = noopClearPrivateCache,
  authenticated,
}: MobileAuthGateProps) {
  const [callbackPending, setCallbackPending] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [session, setSession] = useState<AuthSessionSnapshot>({
    state: "loading",
  });
  const sessionUserId = React.useRef<string | null>(null);
  const sessionTransition = React.useRef(0);
  const beginSessionTransition = React.useCallback(() => {
    sessionTransition.current += 1;
    return sessionTransition.current;
  }, []);
  const updateSession = React.useCallback(
    async (next: AuthSessionSnapshot, transition: number) => {
      if (transition !== sessionTransition.current) {
        return "stale" as const;
      }
      const nextUserId =
        next.state === "authenticated" ? next.principal.userId : null;
      if (sessionUserId.current !== nextUserId) {
        try {
          await clearPrivateCache(sessionUserId.current);
        } catch (error: unknown) {
          if (transition === sessionTransition.current) {
            setSession(recoverySnapshot(error));
            return "cache-clear-failed" as const;
          }
          return "stale" as const;
        }
        if (transition !== sessionTransition.current) {
          return "stale" as const;
        }
        sessionUserId.current = nextUserId;
      }
      setSession(next);
      return "applied" as const;
    },
    [clearPrivateCache],
  );

  useEffect(() => {
    if (callbackPending && session.state === "authenticated") {
      AccessibilityInfo.announceForAccessibility("Completing sign-in");
    }
  }, [callbackPending, session.state]);

  useEffect(() => {
    let active = true;
    const transition = beginSessionTransition();
    restore()
      .then((next) => {
        if (active) {
          void updateSession(next, transition);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          void updateSession(recoverySnapshot(error), transition);
        }
      });
    return () => {
      active = false;
    };
  }, [beginSessionTransition, restore, updateSession]);

  useEffect(() => {
    if (linking === undefined) {
      return;
    }
    let active = true;
    const accept = (url: string): void => {
      if (!url.includes("auth/callback")) {
        return;
      }
      const transition = beginSessionTransition();
      setCallbackPending(true);
      void (async () => {
        let callbackExchangeSucceeded = false;
        try {
          actions.validateCallback(url);
          const completeTransition = await beforeCompleteCallback?.();
          const next = await actions.completeCallback(url);
          callbackExchangeSucceeded = true;
          await completeTransition?.(next);
          const updateResult = await updateSession(next, transition);
          if (updateResult === "cache-clear-failed") {
            await clearFailedCallbackSession?.();
          }
        } catch (error: unknown) {
          if (callbackExchangeSucceeded) {
            // The provider accepted the callback, but account-transition
            // cleanup failed. Do not restore and accidentally accept the new
            // account while the previous account's push registration remains.
            await updateSession(recoverySnapshot(error), transition);
            return;
          }
          let restored: AuthSessionSnapshot;
          try {
            restored = await restore();
          } catch {
            restored = recoverySnapshot(error);
          }
          if (restored.state !== "authenticated") {
            restored = recoverySnapshot(error);
          }
          await updateSession(restored, transition);
        } finally {
          if (active && transition === sessionTransition.current) {
            setCallbackPending(false);
          }
        }
      })();
    };
    const transitionAtLinkStart = sessionTransition.current;
    linking
      .getInitialUrl()
      .then((url) => {
        if (url !== null) {
          accept(url);
        }
      })
      .catch((error: unknown) => {
        if (active && sessionTransition.current === transitionAtLinkStart) {
          const transition = beginSessionTransition();
          void updateSession(recoverySnapshot(error), transition);
        }
      });
    const unsubscribe = linking.subscribe(accept);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    actions,
    beforeCompleteCallback,
    beginSessionTransition,
    clearFailedCallbackSession,
    linking,
    updateSession,
  ]);

  if (session.state === "authenticated") {
    if (callbackPending) {
      return (
        <View style={styles.app}>
          <Text accessibilityRole="text">Completing sign-in…</Text>
        </View>
      );
    }
    return (
      <View style={styles.app}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            setSignOutFailed(false);
            setCallbackPending(false);
            const transition = beginSessionTransition();
            void signOut(session.principal.userId)
              .then((next) => updateSession(next, transition))
              .catch(() => {
                if (transition === sessionTransition.current) {
                  setSignOutFailed(true);
                }
              });
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
        {signOutFailed ? (
          <Text accessibilityRole="alert" style={styles.signOutError}>
            Could not sign out. Your session is still active. Try again.
          </Text>
        ) : null}
        {authenticated(session.principal.userId)}
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <AuthScreen
        session={session}
        actions={{
          requestPhone: actions.requestPhone,
          verifyPhone: async (phone, token) => {
            setCallbackPending(false);
            const transition = beginSessionTransition();
            await updateSession(
              await actions.verifyPhone(phone, token),
              transition,
            );
          },
          requestEmail: actions.requestEmail,
          retry: async () => {
            setCallbackPending(false);
            const transition = beginSessionTransition();
            await updateSession(await restore(), transition);
          },
        }}
      />
    </View>
  );
}

function recoverySnapshot(error: unknown): AuthSessionSnapshot {
  const parsed =
    error instanceof ApplicationError
      ? authErrorCodeSchema.safeParse(error.code)
      : null;
  if (
    error instanceof ApplicationError &&
    parsed !== null &&
    parsed.success &&
    error.message === AUTH_ERROR_MESSAGES[parsed.data]
  ) {
    return {
      state: "recovery",
      errorCode: parsed.data,
      message: error.message,
    };
  }

  return {
    state: "recovery",
    errorCode: "INTERNAL",
    message: AUTH_ERROR_MESSAGES.INTERNAL,
  };
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.color.background.canvas,
  },
  signOut: {
    minHeight: 44,
    minWidth: 44,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: theme.space[4],
  },
  signOutLabel: {
    color: theme.color.brand.primary,
    fontSize: theme.typeScale.labelMd.fontSize,
    fontWeight: "700",
  },
  signOutError: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.bodyMd.fontSize,
    lineHeight: theme.typeScale.bodyMd.lineHeight,
    paddingHorizontal: theme.space[4],
  },
});
