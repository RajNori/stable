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
  readonly authenticated: () => React.ReactNode;
};

export function MobileAuthGate({
  restore,
  signOut,
  actions,
  linking,
  authenticated,
}: MobileAuthGateProps) {
  const [session, setSession] = useState<AuthSessionSnapshot>({
    state: "loading",
  });

  useEffect(() => {
    let active = true;
    restore()
      .then((next) => {
        if (active) {
          setSession(next);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSession(recoverySnapshot(error));
        }
      });
    return () => {
      active = false;
    };
  }, [restore]);

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
            setSession(next);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setSession(recoverySnapshot(error));
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
          setSession(recoverySnapshot(error));
        }
      });
    const unsubscribe = linking.subscribe(accept);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [actions, linking]);

  if (session.state === "authenticated") {
    return (
      <View style={styles.app}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => {
            void signOut()
              .then(setSession)
              .catch((error: unknown) => {
                setSession(recoverySnapshot(error));
              });
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
        {authenticated()}
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
            setSession(await actions.verifyPhone(phone, token));
          },
          requestEmail: actions.requestEmail,
          verifyEmail: async (email, token) => {
            setSession(await actions.verifyEmail(email, token));
          },
          retry: async () => {
            setSession(await restore());
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
