import type { AnnouncementRecord } from "@stable/announcements";
import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import { announcementMessages } from "@stable/announcements";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const theme = themeFor("mustangs");

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: theme.space[4],
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
  action: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
});

function message(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return announcementMessages.readFailed;
}

export function TeamAnnouncementsScreen({
  loadContext,
  loadAnnouncements,
  acknowledge,
  markRead,
  registerDevice,
  removeDevice,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadAnnouncements: (teamId: string) => Promise<AnnouncementRecord[]>;
  acknowledge: (announcement: AnnouncementRecord) => Promise<void>;
  markRead: (announcement: AnnouncementRecord) => Promise<void>;
  registerDevice?: (token: string) => Promise<void>;
  removeDevice?: (token: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState("");
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const announcements = useQuery({
    queryKey: ["team-announcements", teamId],
    queryFn: () => {
      if (teamId === null) {
        throw new Error(announcementMessages.readFailed);
      }
      return loadAnnouncements(teamId);
    },
    enabled: teamId !== null,
    retry: false,
  });

  if (context.isPending || (teamId !== null && announcements.isPending)) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading updates</Text>
      </View>
    );
  }

  if (
    context.isError ||
    context.data === undefined ||
    context.data.club === null ||
    context.data.activeTeam === null
  ) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {context.isError
            ? message(context.error)
            : announcementMessages.forbidden}
        </Text>
      </View>
    );
  }

  if (announcements.isError || announcements.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {message(announcements.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Updates
      </Text>
      {registerDevice !== undefined && removeDevice !== undefined ? (
        <View>
          <TextInput
            accessibilityLabel="Device token"
            value={deviceToken}
            onChangeText={setDeviceToken}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Register device"
            style={styles.action}
            onPress={() => {
              void registerDevice(deviceToken).catch((caught: unknown) => {
                setActionError(message(caught));
              });
            }}
          >
            <Text style={styles.body}>Register device</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove device"
            style={styles.action}
            onPress={() => {
              void removeDevice(deviceToken).catch((caught: unknown) => {
                setActionError(message(caught));
              });
            }}
          >
            <Text style={styles.body}>Remove device</Text>
          </Pressable>
        </View>
      ) : null}
      {actionError === null ? null : (
        <Text accessibilityRole="alert" style={styles.body}>
          {actionError}
        </Text>
      )}
      {announcements.data.length === 0 ? (
        <Text style={styles.body}>No announcements.</Text>
      ) : null}
      {announcements.data.map((announcement) => (
        <View key={announcement.id}>
          <Text style={styles.body}>{announcement.title}</Text>
          <Text style={styles.body}>{announcement.body}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark read ${announcement.title}`}
            style={styles.action}
            onPress={() => {
              void markRead(announcement)
                .then(async () => {
                  setActionError(null);
                  await queryClient.invalidateQueries({
                    queryKey: ["team-announcements", teamId],
                  });
                })
                .catch((caught: unknown) => {
                  setActionError(message(caught));
                });
            }}
          >
            <Text style={styles.body}>Mark read</Text>
          </Pressable>
          {announcement.acknowledgementRequired &&
          announcement.acknowledgedAt === null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Acknowledge ${announcement.title}`}
              style={styles.action}
              onPress={() => {
                void acknowledge(announcement)
                  .then(async () => {
                    setActionError(null);
                    await queryClient.invalidateQueries({
                      queryKey: ["team-announcements", teamId],
                    });
                  })
                  .catch((caught: unknown) => {
                    setActionError(message(caught));
                  });
              }}
            >
              <Text style={styles.body}>Acknowledge</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
