import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { ScheduleEntry } from "@stable/schedule";
import { scheduleMessages } from "@stable/schedule";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

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
});

function message(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return scheduleMessages.readFailed;
}

function label(entry: ScheduleEntry): string {
  if (entry.eventType === "TRAINING") {
    return `Training at ${entry.startsAt}`;
  }
  const round = entry.roundLabel ?? "Game";
  const opponent = entry.opponentName ?? "Opponent";
  return `${round}: ${opponent} at ${entry.startsAt}`;
}

export function TeamScheduleScreen({
  loadContext,
  loadSchedule,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadSchedule: (teamId: string) => Promise<ScheduleEntry[]>;
}) {
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const schedule = useQuery({
    queryKey: ["team-schedule", teamId],
    queryFn: () => {
      if (teamId === null) {
        throw new Error(scheduleMessages.readFailed);
      }
      return loadSchedule(teamId);
    },
    enabled: teamId !== null,
    retry: false,
  });

  if (context.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading schedule</Text>
      </View>
    );
  }

  if (
    context.isError ||
    context.data === undefined ||
    context.data.club === null
  ) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {context.isError
            ? message(context.error)
            : scheduleMessages.forbidden}
        </Text>
      </View>
    );
  }

  if (context.data.activeTeam === null) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Use a context with one team.
        </Text>
      </View>
    );
  }

  if (schedule.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading schedule</Text>
      </View>
    );
  }

  if (schedule.isError || schedule.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {message(schedule.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {context.data.activeTeam.name}
      </Text>
      {schedule.data.length === 0 ? (
        <Text style={styles.body}>No events in this range.</Text>
      ) : null}
      {schedule.data.map((entry) => (
        <Text key={entry.eventId} style={styles.body}>
          {label(entry)}
        </Text>
      ))}
    </View>
  );
}
