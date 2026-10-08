import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  authErrorCodeSchema,
  type AuthSessionSnapshot,
} from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  const [session, setSession] = useState<AuthSessionSnapshot>({
    state: "loading",
  });
  const sessionUserId = React.useRef<string | null>(null);
  const updateSession = React.useCallback(
    async (next: AuthSessionSnapshot) => {
      const nextUserId =
        next.state === "authenticated" ? next.principal.userId : null;
      if (sessionUserId.current !== nextUserId) {
        try {
          await clearPrivateCache(sessionUserId.current);
        } catch (error: unknown) {
          setSession(recoverySnapshot(error));
          return;
        }
        sessionUserId.current = nextUserId;
      }
      setSession(next);
    },
    [clearPrivateCache],
  );

  useEffect(() => {
    let active = true;
    restore()
      .then((next) => {
        if (active) {
          updateSession(next);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          updateSession(recoverySnapshot(error));
        }
      });
    return () => {
      active = false;
    };
  }, [restore, updateSession]);

  useEffect(() => {
    if (linking === undefined) {
      return;
    }
    let active = true;
    const accept = (url: string): void => {
      if (!url.includes("auth/callback")) {
        return;
      }
      actions
        .completeCallback(url)
        .then((next) => {
          if (active) {
            updateSession(next);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            updateSession(recoverySnapshot(error));
          }
        });
    };
    linking
      .getInitialUrl()
      .then((url) => {
        if (url !== null) {
          accept(url);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          updateSession(recoverySnapshot(error));
        }
      });
    const unsubscribe = linking.subscribe(accept);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [actions, linking, updateSession]);

  if (session.state === "authenticated") {
    return (
      <View style={styles.app}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            void signOut()
              .then(updateSession)
              .catch((error: unknown) => {
                updateSession(recoverySnapshot(error));
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
            await updateSession(await actions.verifyPhone(phone, token));
          },
          requestEmail: actions.requestEmail,
          verifyEmail: async (email, token) => {
            await updateSession(await actions.verifyEmail(email, token));
          },
          retry: async () => {
            await updateSession(await restore());
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
