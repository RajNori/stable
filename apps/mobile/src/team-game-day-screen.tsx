import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { GameDayProjection } from "@stable/game-day";
import { gameDayMessages } from "@stable/game-day";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  gameDaySnapshotFromProjection,
  type GameDaySnapshot,
  type GameDaySnapshotStore,
} from "./game-day-snapshot";
import {
  clearStoredOfflineGameDay,
  contextPermitsTeam,
  isOfflineAuthorizationFailure,
  persistOfflineGameDay,
  readOfflineGameDay,
  removeObsoleteOfflineGameDay,
} from "./offline-context";
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
  localUserId,
  online = true,
  now = Date.now(),
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadGameDay: (teamId: string) => Promise<GameDayProjection | null>;
  snapshotStore?: GameDaySnapshotStore | undefined;
  localUserId?: string | undefined;
  online?: boolean | null | undefined;
  now?: number | undefined;
}) {
  const offlineEnabled =
    snapshotStore !== undefined && localUserId !== undefined;
  const offline = useQuery({
    queryKey: ["offline-game-day", localUserId],
    queryFn: () => {
      if (snapshotStore === undefined || localUserId === undefined) {
        return Promise.resolve(null);
      }
      return readOfflineGameDay(snapshotStore, localUserId);
    },
    enabled: offlineEnabled,
    retry: false,
  });
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    enabled: online === true,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const userId = context.data?.userId;
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
        userId !== undefined &&
        (localUserId === undefined || localUserId === userId)
      ) {
        await persistOfflineGameDay(
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
    enabled: online === true && teamId !== null,
    retry: false,
  });

  useEffect(() => {
    if (
      snapshotStore === undefined ||
      localUserId === undefined ||
      online !== true
    ) {
      return;
    }
    if (context.isError && isOfflineAuthorizationFailure(context.error)) {
      void clearStoredOfflineGameDay(snapshotStore, localUserId);
      return;
    }
    if (context.data !== undefined && context.data.userId === localUserId) {
      void removeObsoleteOfflineGameDay(
        snapshotStore,
        localUserId,
        context.data,
      );
    }
  }, [
    context.data,
    context.error,
    context.isError,
    localUserId,
    online,
    snapshotStore,
  ]);

  const sawOnline = useRef(false);
  const refreshFloor = useRef(0);
  if (online === true) {
    if (!sawOnline.current) {
      sawOnline.current = true;
      refreshFloor.current = Date.now();
    }
  } else {
    sawOnline.current = false;
  }
  const refreshLanded = gameDay.dataUpdatedAt >= refreshFloor.current;

  const cached = offline.data ?? null;
  const snapshot = visibleSnapshot({
    cached,
    localUserId,
    online,
    contextData: context.data,
    contextError: context.error,
    contextIsError: context.isError,
  });

  if (online === null || (offlineEnabled && offline.isLoading)) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading game day</Text>
      </View>
    );
  }

  if (online === false) {
    return <OfflineGameDayView snapshot={snapshot} now={now} />;
  }

  if (context.isPending) {
    if (snapshot !== null) {
      return <OfflineGameDayView snapshot={snapshot} now={now} />;
    }
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading game day</Text>
      </View>
    );
  }

  if (
    context.isError ||
    context.data === undefined ||
    context.data.club === null ||
    (localUserId !== undefined &&
      context.data !== undefined &&
      context.data.userId !== localUserId)
  ) {
    if (
      context.isError &&
      !isOfflineAuthorizationFailure(context.error) &&
      snapshot !== null
    ) {
      return <OfflineGameDayView snapshot={snapshot} now={now} />;
    }
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {context.isError ? message(context.error) : gameDayMessages.forbidden}
        </Text>
      </View>
    );
  }

  if (context.data.activeTeam === null) {
    if (
      snapshot !== null &&
      contextPermitsTeam(context.data, snapshot.teamId)
    ) {
      return <OfflineGameDayView snapshot={snapshot} now={now} />;
    }
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Use a context with one team.
        </Text>
      </View>
    );
  }

  if (!refreshLanded || gameDay.isError || gameDay.data === undefined) {
    if (snapshot !== null && snapshot.teamId === context.data.activeTeam.id) {
      return <OfflineGameDayView snapshot={snapshot} now={now} />;
    }
    if (gameDay.isError) {
      return (
        <View style={styles.screen}>
          <Text accessibilityRole="header" style={styles.title}>
            {message(gameDay.error)}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading game day</Text>
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
      <Text accessibilityRole="header" style={styles.title}>
        {projection.roundLabel ?? "Game"}: {projection.opponentName}
      </Text>
      <Text style={styles.body}>RSVP {projection.ownRsvp}</Text>
      <Text style={styles.body}>Duty {projection.ownDutyLabel ?? "None"}</Text>
      <Text style={styles.body}>
        Fill-in {projection.fillInLabel ?? "None"}
      </Text>
      {projection.attendingCount === null ? null : (
        <Text style={styles.body}>
          Attending {projection.attendingCount}, unanswered{" "}
          {projection.unansweredCount}
        </Text>
      )}
    </View>
  );
}

function visibleSnapshot(input: {
  cached: GameDaySnapshot | null;
  localUserId: string | undefined;
  online: boolean | null;
  contextData: CurrentClubContext | undefined;
  contextError: unknown;
  contextIsError: boolean;
}): GameDaySnapshot | null {
  const cached = input.cached;
  if (cached === null || input.localUserId === undefined) {
    return null;
  }
  if (cached.userId !== input.localUserId) {
    return null;
  }
  if (
    input.online === true &&
    input.contextIsError &&
    isOfflineAuthorizationFailure(input.contextError)
  ) {
    return null;
  }
  if (input.online === true && input.contextData !== undefined) {
    if (input.contextData.userId !== input.localUserId) {
      return null;
    }
    if (!contextPermitsTeam(input.contextData, cached.teamId)) {
      return null;
    }
    if (
      input.contextData.activeTeam !== null &&
      input.contextData.activeTeam.id !== cached.teamId
    ) {
      return null;
    }
  }
  return cached;
}
