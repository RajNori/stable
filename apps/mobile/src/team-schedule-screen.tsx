import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { ScheduleEntry } from "@stable/schedule";
import { formatScheduleDateTime, scheduleMessages } from "@stable/schedule";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ReadRetryControl } from "./read-retry-control";

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
  event: {
    minHeight: 48,
    justifyContent: "center",
    gap: theme.space[1],
    padding: theme.space[3],
    borderColor: theme.color.border.default,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background.surface,
  },
  eventLabel: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.bodyMd.fontSize,
    lineHeight: theme.typeScale.bodyMd.lineHeight,
    fontWeight: "600",
  },
  details: {
    gap: theme.space[2],
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background.surface,
  },
});

function message(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }
  return scheduleMessages.readFailed;
}

function label(entry: ScheduleEntry, timezone: string): string {
  const time = formatScheduleDateTime(entry.startsAt, timezone);
  if (entry.eventType === "TRAINING") {
    return `Training at ${time}`;
  }
  const round = entry.roundLabel ?? "Game";
  const opponent = entry.opponentName ?? "Opponent";
  return `${round}: ${opponent} at ${time}`;
}

function durationLabel(entry: ScheduleEntry): string | null {
  if (entry.endsAt === null) return null;
  const minutes = Math.round(
    (Date.parse(entry.endsAt) - Date.parse(entry.startsAt)) / 60_000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export function TeamScheduleScreen({
  loadContext,
  loadSchedule,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadSchedule: (teamId: string) => Promise<ScheduleEntry[]>;
}) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
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

  if (context.isError || context.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {context.isError
            ? message(context.error)
            : scheduleMessages.forbidden}
        </Text>
        {context.isError ? (
          <ReadRetryControl
            disabled={context.isFetching}
            onPress={() => void context.refetch()}
          />
        ) : null}
      </View>
    );
  }

  const currentContext = context.data;
  const timezone = currentContext.club?.timezone;
  if (timezone === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {scheduleMessages.forbidden}
        </Text>
      </View>
    );
  }

  if (currentContext.activeTeam === null) {
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
        <ReadRetryControl
          disabled={schedule.isFetching}
          onPress={() => void schedule.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {currentContext.activeTeam.name}
      </Text>
      {schedule.data.length === 0 ? (
        <Text style={styles.body}>No events in this range.</Text>
      ) : null}
      {schedule.data.map((entry) => (
        <View key={entry.eventId} style={{ gap: theme.space[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label(entry, timezone)}
            accessibilityState={{
              expanded: expandedEventId === entry.eventId,
            }}
            onPress={() =>
              setExpandedEventId((current) =>
                current === entry.eventId ? null : entry.eventId,
              )
            }
            style={styles.event}
          >
            <Text style={styles.eventLabel}>{label(entry, timezone)}</Text>
            {entry.courtLabel ? (
              <Text style={styles.body}>Court: {entry.courtLabel}</Text>
            ) : null}
          </Pressable>
          {expandedEventId === entry.eventId ? (
            <View
              accessibilityLabel={
                entry.eventType === "TRAINING"
                  ? "Training details"
                  : "Game details"
              }
              style={styles.details}
            >
              <Text accessibilityRole="header" style={styles.eventLabel}>
                {entry.eventType === "TRAINING"
                  ? "Training details"
                  : "Game details"}
              </Text>
              <Text style={styles.body}>
                {formatScheduleDateTime(entry.startsAt, timezone)}
              </Text>
              <Text style={styles.body}>
                Status: {entry.eventStatus.toLowerCase()}
              </Text>
              {entry.courtLabel ? (
                <Text style={styles.body}>Court: {entry.courtLabel}</Text>
              ) : null}
              {durationLabel(entry) !== null ? (
                <Text style={styles.body}>
                  Duration: {durationLabel(entry)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
