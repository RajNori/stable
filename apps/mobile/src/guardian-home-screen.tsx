import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import type { AnnouncementRecord } from "@stable/announcements";
import { themeFor } from "@stable/design-tokens";
import type { GameDayProjection } from "@stable/game-day";
import type { ScheduleEntry } from "@stable/schedule";
import { formatScheduleDateTime } from "@stable/schedule";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const theme = themeFor("mustangs");
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[6],
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
    padding: theme.space[4],
    gap: theme.space[2],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.md,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: theme.space[4],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.brand.accent,
    borderRadius: theme.radius.md,
  },
});

function errorMessage(error: unknown): string {
  if (error instanceof ApplicationError) return error.message;
  return "Home could not be loaded. Check your connection and try again.";
}

function eventTitle(event: ScheduleEntry): string {
  if (event.eventType === "TRAINING") return "Training";
  return `${event.roundLabel ?? "Game"}: ${event.opponentName ?? "Opponent"}`;
}

function eventTime(event: ScheduleEntry, timezone: string): string {
  return formatScheduleDateTime(event.startsAt, timezone);
}

export function GuardianHomeScreen({
  loadContext,
  loadSchedule,
  loadGameDay,
  loadAnnouncements,
  onOpenSchedule,
  onOpenGameDay,
  onOpenUpdates,
  now = Date.now(),
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadSchedule: (teamId: string) => Promise<ScheduleEntry[]>;
  loadGameDay: (teamId: string) => Promise<GameDayProjection | null>;
  loadAnnouncements: (teamId: string) => Promise<AnnouncementRecord[]>;
  onOpenSchedule: () => void;
  onOpenGameDay: () => void;
  onOpenUpdates: () => void;
  now?: number;
}) {
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId = context.data?.activeTeam?.id ?? null;
  const home = useQuery({
    queryKey: ["guardian-home", teamId],
    queryFn: async () => {
      if (teamId === null) throw new Error("No active team");
      const [schedule, announcements] = await Promise.all([
        loadSchedule(teamId),
        loadAnnouncements(teamId).catch(() => null),
      ]);
      return { schedule, announcements };
    },
    enabled: teamId !== null,
    retry: false,
  });
  const nextEvent = home.data?.schedule
    ?.filter(
      (event) =>
        event.eventStatus === "SCHEDULED" && Date.parse(event.startsAt) >= now,
    )
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  const gameDay = useQuery({
    queryKey: ["guardian-home-game-day", teamId],
    queryFn: () => {
      if (teamId === null) throw new Error("No active team");
      return loadGameDay(teamId);
    },
    enabled: teamId !== null && nextEvent?.eventType === "GAME",
    retry: false,
  });
  const latestAnnouncement = home.data?.announcements
    ?.filter((item) => item.archivedAt === null)
    .reduce<AnnouncementRecord | null>(
      (latest, item) =>
        latest === null ||
        Date.parse(item.publishedAt) > Date.parse(latest.publishedAt)
          ? item
          : latest,
      null,
    );

  if (context.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body} accessibilityRole="progressbar">
          Loading your home
        </Text>
      </View>
    );
  }
  if (context.isError || context.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {errorMessage(context.error)}
        </Text>
      </View>
    );
  }
  if (context.data.club === null) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Your club is not set up yet.
        </Text>
      </View>
    );
  }
  if (teamId === null) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Choose an available team to continue.
        </Text>
      </View>
    );
  }
  if (home.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body} accessibilityRole="progressbar">
          Finding what is next
        </Text>
      </View>
    );
  }
  if (home.isError || home.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {errorMessage(home.error)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open schedule"
          onPress={onOpenSchedule}
          style={styles.action}
        >
          <Text style={styles.body}>Open schedule</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        Hi {context.data.displayName}
      </Text>
      <Text style={styles.body}>{context.data.activeTeam?.name}</Text>
      <View style={styles.card}>
        <Text style={styles.title}>Next up</Text>
        {nextEvent === undefined ? (
          <Text style={styles.body}>Nothing scheduled yet.</Text>
        ) : (
          <>
            <Text style={styles.body}>{eventTitle(nextEvent)}</Text>
            <Text style={styles.body}>
              {eventTime(nextEvent, context.data.club.timezone)}
            </Text>
            {nextEvent.courtLabel === null ? null : (
              <Text style={styles.body}>{nextEvent.courtLabel}</Text>
            )}
            {nextEvent.eventType === "GAME" &&
            gameDay.data?.eventId === nextEvent.eventId ? (
              <>
                {gameDay.data.arrivalAt === null ? null : (
                  <Text style={styles.body}>
                    Arrive{" "}
                    {eventTime(
                      { ...nextEvent, startsAt: gameDay.data.arrivalAt },
                      context.data.club.timezone,
                    )}
                  </Text>
                )}
                {gameDay.data.venueText === null ? null : (
                  <Text style={styles.body}>{gameDay.data.venueText}</Text>
                )}
                <Text style={styles.body}>
                  Your duty: {gameDay.data.ownDutyLabel ?? "None"}
                </Text>
              </>
            ) : null}
            {nextEvent.eventType === "GAME" && gameDay.isError ? (
              <Text style={styles.body} accessibilityRole="alert">
                Game actions are temporarily unavailable.
              </Text>
            ) : null}
            {nextEvent.eventType === "GAME" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Respond to game"
                onPress={onOpenGameDay}
                style={styles.action}
              >
                <Text style={styles.body}>Open Game Day</Text>
              </Pressable>
            ) : null}
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open schedule"
          onPress={onOpenSchedule}
          style={styles.action}
        >
          <Text style={styles.body}>Open schedule</Text>
        </Pressable>
      </View>
      {latestAnnouncement ? (
        <View style={styles.card}>
          <Text style={styles.title}>Latest team update</Text>
          <Text style={styles.body}>{latestAnnouncement.title}</Text>
          <Text style={styles.body}>{latestAnnouncement.body}</Text>
          {latestAnnouncement.acknowledgementRequired &&
          latestAnnouncement.acknowledgedAt === null ? (
            <Text style={styles.body}>Response requested</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open team updates"
            onPress={onOpenUpdates}
            style={styles.action}
          >
            <Text style={styles.body}>Open team updates</Text>
          </Pressable>
        </View>
      ) : null}
      {home.data.announcements !== null && latestAnnouncement === null ? (
        <Text style={styles.body}>No recent team updates.</Text>
      ) : null}
      {home.data.announcements === null ? (
        <Text style={styles.body} accessibilityRole="alert">
          Team updates are temporarily unavailable.
        </Text>
      ) : null}
    </View>
  );
}
