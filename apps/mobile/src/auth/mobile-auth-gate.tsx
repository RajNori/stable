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
  verifyEmail: (email: string, token: string) => Promise<AuthSessionSnapshot>;
  completeCallback: (callbackUrl: string) => Promise<AuthSessionSnapshot>;
};

type MobileAuthGateProps = {
  readonly restore: () => Promise<AuthSessionSnapshot>;
  readonly signOut: () => Promise<AuthSessionSnapshot>;
  readonly actions: GateActions;
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
  linking,
  clearPrivateCache = noopClearPrivateCache,
  authenticated,
}: MobileAuthGateProps) {
  const [callbackPending, setCallbackPending] = useState(false);
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
        return;
      }
      const nextUserId =
        next.state === "authenticated" ? next.principal.userId : null;
      if (sessionUserId.current !== nextUserId) {
        try {
          await clearPrivateCache(sessionUserId.current);
        } catch (error: unknown) {
          if (transition === sessionTransition.current) {
            setSession(recoverySnapshot(error));
          }
          return;
        }
        if (transition !== sessionTransition.current) {
          return;
        }
        sessionUserId.current = nextUserId;
      }
      setSession(next);
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
        try {
          await updateSession(await actions.completeCallback(url), transition);
        } catch (error: unknown) {
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
  }, [actions, beginSessionTransition, linking, updateSession]);

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
            setCallbackPending(false);
            const transition = beginSessionTransition();
            void signOut()
              .then((next) => updateSession(next, transition))
              .catch((error: unknown) => {
                void updateSession(recoverySnapshot(error), transition);
              });
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
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
          verifyEmail: async (email, token) => {
            setCallbackPending(false);
            const transition = beginSessionTransition();
            await updateSession(
              await actions.verifyEmail(email, token),
              transition,
            );
          },
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
});
