import type { CurrentClubContext } from "@stable/contracts";
import {
  NOTIFICATION_TYPES,
  type NotificationPreference,
  notificationMessages,
} from "@stable/notifications";
import { themeFor } from "@stable/design-tokens";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import type { PushRegistrationResult } from "./push-registration";
import { ReadRetryControl } from "./read-retry-control";

const theme = themeFor("mustangs");
const labels: Record<(typeof NOTIFICATION_TYPES)[number], string> = {
  FIXTURE_CHANGED: "Fixture changes",
  GAME_REMINDER: "Game reminders",
  RSVP_REQUIRED: "RSVP reminders",
  TRAINING_CHANGED: "Training changes",
  TRAINING_CANCELLED: "Training cancellations",
  ANNOUNCEMENT_PUBLISHED: "Team updates",
  DUTY_ASSIGNED: "Duty assignments",
  DUTY_SWAP_REQUESTED: "Duty swap requests",
  DUTY_SWAP_ACCEPTED: "Duty swap updates",
  FILL_IN_REQUESTED: "Fill-in requests",
  FILL_IN_CONFIRMED: "Fill-in confirmations",
  COACH_CHECKED_IN: "Coach check-ins",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    gap: theme.space[3],
  },
  title: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.headingMd.fontSize,
    lineHeight: theme.typeScale.headingMd.lineHeight,
    fontWeight: theme.typeScale.headingMd.fontWeight,
  },
  body: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.bodyMd.fontSize,
    lineHeight: theme.typeScale.bodyMd.lineHeight,
  },
  card: {
    padding: theme.space[3],
    gap: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.md,
  },
  preference: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[3],
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingHorizontal: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.sm,
  },
});

function safeError(error: unknown): string {
  void error;
  return notificationMessages.readFailed;
}

export function ProfileScreen({
  loadContext,
  loadPreferences,
  savePreference,
  requestPush,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadPreferences: () => Promise<NotificationPreference[]>;
  savePreference: (value: NotificationPreference) => Promise<void>;
  requestPush: () => Promise<PushRegistrationResult>;
}) {
  const queryClient = useQueryClient();
  const [pushStatus, setPushStatus] = React.useState<string | null>(null);
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const preferences = useQuery({
    queryKey: ["notification-preferences", context.data?.userId],
    queryFn: loadPreferences,
    enabled: context.data?.userId !== undefined,
    retry: false,
  });
  const save = useMutation({
    mutationFn: savePreference,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notification-preferences", context.data?.userId],
      });
    },
  });

  if (context.isPending) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="progressbar" style={styles.body}>
          Loading profile
        </Text>
      </View>
    );
  }
  if (context.isError || context.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Your profile could not be loaded.
        </Text>
        <ReadRetryControl
          disabled={context.isFetching}
          onPress={() => void context.refetch()}
        />
      </View>
    );
  }

  const preferenceMap = new Map(
    (preferences.data ?? []).map((preference) => [
      preference.category,
      preference.pushEnabled,
    ]),
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Profile
      </Text>
      <View style={styles.card}>
        <Text style={styles.body}>{context.data.displayName}</Text>
        {context.data.club === null ? null : (
          <Text style={styles.body}>{context.data.club.name}</Text>
        )}
        {context.data.activeTeam === null ? null : (
          <Text style={styles.body}>{context.data.activeTeam.name}</Text>
        )}
        <Text style={styles.body}>
          {`Managed children: ${context.data.managedPlayerIds.length}`}
        </Text>
        <Text style={styles.body}>
          Sign out using the button at the top of the screen. Signing out clears
          this device’s private cached data.
        </Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Notifications
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enable push notifications"
        disabled={save.isPending}
        onPress={() => {
          setPushStatus("Setting up notifications…");
          void requestPush()
            .then((result) => {
              if (result.status === "registered") {
                setPushStatus("Notifications are enabled on this device.");
              } else if (result.status === "permission-denied") {
                setPushStatus(
                  "Notification permission is off. You can change it in device settings.",
                );
              } else if (result.status === "cleanup-pending") {
                setPushStatus(
                  "Push setup is paused while this device finishes account cleanup. Sign in again or retry shortly.",
                );
              } else {
                setPushStatus(
                  "Push notifications are not configured for this app build yet.",
                );
              }
            })
            .catch(() => {
              setPushStatus(
                "Push notifications could not be set up. Try again.",
              );
            });
        }}
        style={styles.action}
      >
        <Text style={styles.body}>Enable push notifications</Text>
      </Pressable>
      {pushStatus === null ? null : (
        <Text accessibilityRole="alert" style={styles.body}>
          {pushStatus}
        </Text>
      )}
      {preferences.isPending ? (
        <Text accessibilityRole="progressbar" style={styles.body}>
          Loading notification preferences
        </Text>
      ) : preferences.isError ? (
        <View>
          <Text accessibilityRole="alert" style={styles.body}>
            {safeError(preferences.error)}
          </Text>
          <ReadRetryControl
            disabled={preferences.isFetching}
            onPress={() => void preferences.refetch()}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.body}>
            Choose which team events may send you a push notification.
          </Text>
          {NOTIFICATION_TYPES.map((category) => {
            const enabled = preferenceMap.get(category) ?? true;
            return (
              <View key={category} style={styles.preference}>
                <Text style={styles.body}>{labels[category]}</Text>
                <Switch
                  accessibilityLabel={labels[category]}
                  value={enabled}
                  disabled={save.isPending}
                  onValueChange={(pushEnabled) => {
                    save.mutate({ category, pushEnabled });
                  }}
                />
              </View>
            );
          })}
          {save.isError ? (
            <Text accessibilityRole="alert" style={styles.body}>
              Notification preference could not be saved. Try again.
            </Text>
          ) : null}
        </View>
      )}
      <Text style={styles.body}>
        For help with your club access, contact your club administrator.
      </Text>
    </ScrollView>
  );
}
