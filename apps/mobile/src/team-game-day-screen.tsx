import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { GameDayProjection } from "@stable/game-day";
import { gameDayMessages } from "@stable/game-day";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const theme = themeFor("mustangs");

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: theme.space[4],
    gap: theme.space[2],
  },
  title: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.headingMd.fontSize,
    lineHeight: theme.typeScale.headingMd.lineHeight,
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
  return gameDayMessages.readFailed;
}

export function TeamGameDayScreen({
  loadContext,
  loadGameDay,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadGameDay: (teamId: string) => Promise<GameDayProjection | null>;
}) {
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const gameDay = useQuery({
    queryKey: ["game-day", teamId],
    queryFn: () => {
      if (teamId === null) {
        throw new Error(gameDayMessages.readFailed);
      }
      return loadGameDay(teamId);
    },
    enabled: teamId !== null,
    retry: false,
  });

  if (context.isPending || (teamId !== null && gameDay.isPending)) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading game day</Text>
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
        <Text style={styles.title}>
          {context.isError ? message(context.error) : gameDayMessages.forbidden}
        </Text>
      </View>
    );
  }

  if (context.data.activeTeam === null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Use a context with one team.</Text>
      </View>
    );
  }

  if (gameDay.isError || gameDay.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{message(gameDay.error)}</Text>
      </View>
    );
  }

  if (gameDay.data === null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>No game day yet.</Text>
      </View>
    );
  }

  const projection = gameDay.data;
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>
        {projection.roundLabel ?? "Game"}: {projection.opponentName}
      </Text>
      <Text style={styles.body}>RSVP {projection.ownRsvp}</Text>
      <Text style={styles.body}>Duty {projection.ownDutyLabel ?? "None"}</Text>
      {projection.attendingCount === null ? null : (
        <Text style={styles.body}>
          Attending {projection.attendingCount}, unanswered{" "}
          {projection.unansweredCount}
        </Text>
      )}
    </View>
  );
}
