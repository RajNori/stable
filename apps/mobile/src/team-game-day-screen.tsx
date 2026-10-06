import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { GameDayProjection } from "@stable/game-day";
import { gameDayMessages } from "@stable/game-day";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  gameDaySnapshotFromProjection,
  readGameDaySnapshot,
  saveGameDaySnapshot,
  type GameDaySnapshotStore,
} from "./game-day-snapshot";
import { OfflineGameDayView } from "./offline-game-day-view";

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
  snapshotStore,
  online = true,
  now = Date.now(),
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadGameDay: (teamId: string) => Promise<GameDayProjection | null>;
  snapshotStore?: GameDaySnapshotStore | undefined;
  online?: boolean | undefined;
  now?: number | undefined;
}) {
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const userId = context.data?.userId;
  const cached = useQuery({
    queryKey: ["game-day-snapshot", userId, teamId],
    queryFn: () => {
      if (
        snapshotStore === undefined ||
        userId === undefined ||
        teamId === null
      ) {
        return Promise.resolve(null);
      }
      return readGameDaySnapshot(snapshotStore, userId, teamId);
    },
    enabled:
      snapshotStore !== undefined && userId !== undefined && teamId !== null,
    retry: false,
  });
  const gameDay = useQuery({
    queryKey: ["game-day", teamId],
    queryFn: async () => {
      if (
        teamId === null ||
        context.data === undefined ||
        context.data.activeTeam === null
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      const team = context.data.activeTeam;
      const projection = await loadGameDay(teamId);
      if (
        projection !== null &&
        snapshotStore !== undefined &&
        userId !== undefined
      ) {
        await saveGameDaySnapshot(
          snapshotStore,
          gameDaySnapshotFromProjection({
            userId,
            teamName: team.name,
            projection,
            savedAt: new Date(now).toISOString(),
          }),
        );
      }
      return projection;
    },
    enabled: online && teamId !== null,
    retry: false,
  });

  if (!online) {
    if (teamId !== null && cached.isPending) {
      return (
        <View style={styles.screen}>
          <Text style={styles.body}>Loading game day</Text>
        </View>
      );
    }
    return <OfflineGameDayView snapshot={cached.data ?? null} now={now} />;
  }

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
    if (cached.data !== undefined && cached.data !== null) {
      return <OfflineGameDayView snapshot={cached.data} now={now} />;
    }
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
