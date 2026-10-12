import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { GameDayProjection } from "@stable/game-day";
import { gameDayMessages } from "@stable/game-day";
import { formatScheduleDateTime } from "@stable/schedule";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MobileRsvpChoice } from "./load-mobile-rsvp";
import type { MobileFillInProjection } from "./load-mobile-fill-in";
import type { DutySwapRecord } from "@stable/game-day";

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
  rsvpCard: {
    gap: theme.space[2],
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.md,
  },
  rsvpActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2],
  },
  rsvpButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.sm,
  },
  rsvpButtonSelected: {
    backgroundColor: theme.color.brand.accent,
    borderColor: theme.color.brand.accent,
  },
  fillInCard: {
    gap: theme.space[2],
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.md,
  },
  dutyCard: {
    gap: theme.space[2],
    padding: theme.space[3],
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radius.md,
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
  loadRsvpChoices,
  saveRsvp,
  loadFillInOptions,
  respondFillIn,
  loadDutySwaps,
  acknowledgeDuty,
  requestDutySwap,
  acceptDutySwap,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadGameDay: (teamId: string) => Promise<GameDayProjection | null>;
  snapshotStore?: GameDaySnapshotStore | undefined;
  localUserId?: string | undefined;
  online?: boolean | null | undefined;
  now?: number | undefined;
  loadRsvpChoices?:
    | ((
        teamId: string,
        eventId: string,
      ) => Promise<readonly MobileRsvpChoice[]>)
    | undefined;
  saveRsvp?:
    | ((input: {
        teamId: string;
        eventId: string;
        playerId: string;
        status: "ATTENDING" | "UNAVAILABLE" | "UNSURE";
      }) => Promise<void>)
    | undefined;
  loadFillInOptions?:
    | ((teamId: string, eventId: string) => Promise<MobileFillInProjection>)
    | undefined;
  respondFillIn?:
    | ((input: {
        teamId: string;
        requestId: string;
        playerId: string;
      }) => Promise<void>)
    | undefined;
  loadDutySwaps?:
    | ((teamId: string, eventId: string) => Promise<readonly DutySwapRecord[]>)
    | undefined;
  acknowledgeDuty?:
    | ((input: { teamId: string; eventId: string }) => Promise<number>)
    | undefined;
  requestDutySwap?:
    | ((input: { teamId: string; eventId: string }) => Promise<unknown>)
    | undefined;
  acceptDutySwap?:
    | ((input: { teamId: string; requestId: string }) => Promise<unknown>)
    | undefined;
}) {
  const queryClient = useQueryClient();
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
      const currentContext = context.data;
      if (
        teamId === null ||
        currentContext === undefined ||
        currentContext.club === null ||
        currentContext.activeTeam === null
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      const team = currentContext.activeTeam;
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
            timezone: currentContext.club.timezone,
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
  const rsvpChoices = useQuery({
    queryKey: ["managed-attendance", teamId, gameDay.data?.eventId],
    queryFn: () => {
      if (
        teamId === null ||
        gameDay.data?.eventId === undefined ||
        loadRsvpChoices === undefined
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      return loadRsvpChoices(teamId, gameDay.data.eventId);
    },
    enabled:
      online === true &&
      refreshLanded &&
      teamId !== null &&
      gameDay.data?.eventId !== undefined &&
      loadRsvpChoices !== undefined,
    retry: false,
  });
  const rsvpMutation = useMutation({
    mutationFn: (input: {
      teamId: string;
      eventId: string;
      playerId: string;
      status: "ATTENDING" | "UNAVAILABLE" | "UNSURE";
    }) => {
      if (saveRsvp === undefined) throw new Error(gameDayMessages.readFailed);
      return saveRsvp(input);
    },
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["managed-attendance", input.teamId, input.eventId],
      });
    },
  });
  const fillInOptions = useQuery({
    queryKey: ["game-fill-in", teamId, gameDay.data?.eventId],
    queryFn: () => {
      if (
        teamId === null ||
        gameDay.data?.eventId === undefined ||
        loadFillInOptions === undefined
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      return loadFillInOptions(teamId, gameDay.data.eventId);
    },
    enabled:
      online === true &&
      refreshLanded &&
      teamId !== null &&
      gameDay.data?.eventId !== undefined &&
      loadFillInOptions !== undefined,
    retry: false,
  });
  const fillInMutation = useMutation({
    mutationFn: (input: { requestId: string; playerId: string }) => {
      if (teamId === null || respondFillIn === undefined) {
        throw new Error(gameDayMessages.readFailed);
      }
      return respondFillIn({ ...input, teamId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["game-fill-in", teamId, gameDay.data?.eventId],
      });
    },
  });
  const dutySwaps = useQuery({
    queryKey: ["game-duty-swaps", teamId, gameDay.data?.eventId],
    queryFn: () => {
      if (
        teamId === null ||
        gameDay.data?.eventId === undefined ||
        loadDutySwaps === undefined
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      return loadDutySwaps(teamId, gameDay.data.eventId);
    },
    enabled:
      online === true &&
      refreshLanded &&
      teamId !== null &&
      gameDay.data?.eventId !== undefined &&
      loadDutySwaps !== undefined,
    retry: false,
  });
  const acknowledgeDutyMutation = useMutation({
    mutationFn: () => {
      const eventId = gameDay.data?.eventId;
      if (
        teamId === null ||
        eventId === undefined ||
        acknowledgeDuty === undefined
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      return acknowledgeDuty({ teamId, eventId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["game-day", teamId],
      });
    },
  });
  const requestDutySwapMutation = useMutation({
    mutationFn: () => {
      const eventId = gameDay.data?.eventId;
      if (
        teamId === null ||
        eventId === undefined ||
        requestDutySwap === undefined
      ) {
        throw new Error(gameDayMessages.readFailed);
      }
      return requestDutySwap({ teamId, eventId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["game-duty-swaps", teamId, gameDay.data?.eventId],
      });
    },
  });
  const acceptDutySwapMutation = useMutation({
    mutationFn: (requestId: string) => {
      if (teamId === null || acceptDutySwap === undefined) {
        throw new Error(gameDayMessages.readFailed);
      }
      return acceptDutySwap({ teamId, requestId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["game-duty-swaps", teamId, gameDay.data?.eventId],
        }),
        queryClient.invalidateQueries({ queryKey: ["game-day", teamId] }),
      ]);
    },
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
  const timezone = context.data.club.timezone;
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {projection.roundLabel ?? "Game"}: {projection.opponentName}
      </Text>
      <Text style={styles.body}>
        Official start{" "}
        {formatScheduleDateTime(projection.officialStartAt, timezone)}
      </Text>
      <Text style={styles.body}>
        Arrival{" "}
        {projection.arrivalAt === null
          ? "Not set"
          : formatScheduleDateTime(projection.arrivalAt, timezone)}
      </Text>
      <Text style={styles.body}>Venue {projection.venueText ?? "Not set"}</Text>
      <Text style={styles.body}>
        Court {projection.courtLabel ?? "Not set"}
      </Text>
      {loadRsvpChoices === undefined ? (
        <Text style={styles.body}>RSVP {projection.ownRsvp}</Text>
      ) : null}
      <Text style={styles.body}>Duty {projection.ownDutyLabel ?? "None"}</Text>
      {acknowledgeDuty === undefined &&
      requestDutySwap === undefined &&
      loadDutySwaps === undefined ? null : (
        <View style={styles.dutyCard}>
          <Text style={styles.body}>Your game duty</Text>
          {projection.ownDutyStatus === "ASSIGNED" ? (
            <>
              {acknowledgeDuty === undefined ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Acknowledge my duty"
                  accessibilityState={{
                    disabled: acknowledgeDutyMutation.isPending,
                    busy: acknowledgeDutyMutation.isPending,
                  }}
                  disabled={acknowledgeDutyMutation.isPending}
                  onPress={() => acknowledgeDutyMutation.mutate()}
                  style={styles.rsvpButton}
                >
                  <Text style={styles.body}>Acknowledge duty</Text>
                </Pressable>
              )}
              {requestDutySwap === undefined ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Request an open duty swap"
                  accessibilityState={{
                    disabled: requestDutySwapMutation.isPending,
                    busy: requestDutySwapMutation.isPending,
                  }}
                  disabled={requestDutySwapMutation.isPending}
                  onPress={() => requestDutySwapMutation.mutate()}
                  style={styles.rsvpButton}
                >
                  <Text style={styles.body}>Request a swap</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.body}>No duty assigned to you</Text>
          )}
          {acknowledgeDutyMutation.isSuccess ? (
            <Text style={styles.body}>Duty acknowledged.</Text>
          ) : null}
          {requestDutySwapMutation.isSuccess ? (
            <Text style={styles.body}>Open swap request sent.</Text>
          ) : null}
          {acknowledgeDutyMutation.isError ||
          requestDutySwapMutation.isError ? (
            <Text style={styles.body} accessibilityRole="alert">
              Duty change could not be saved. Refresh and try again.
            </Text>
          ) : null}
          {loadDutySwaps === undefined ? null : dutySwaps.isPending ? (
            <Text style={styles.body} accessibilityRole="progressbar">
              Checking open swaps
            </Text>
          ) : dutySwaps.isError ? (
            <Text style={styles.body} accessibilityRole="alert">
              Open swaps could not be loaded. Refresh and try again.
            </Text>
          ) : dutySwaps.data?.length === 0 ? (
            <Text style={styles.body}>No open swaps</Text>
          ) : (
            dutySwaps.data?.map((swap) => (
              <View key={swap.id} style={styles.rsvpCard}>
                <Text style={styles.body}>{swap.label}</Text>
                {acceptDutySwap === undefined ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Accept swap for ${swap.label}`}
                    accessibilityState={{
                      disabled: acceptDutySwapMutation.isPending,
                      busy: acceptDutySwapMutation.isPending,
                    }}
                    disabled={acceptDutySwapMutation.isPending}
                    onPress={() => acceptDutySwapMutation.mutate(swap.id)}
                    style={styles.rsvpButton}
                  >
                    <Text style={styles.body}>Accept swap</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
          {acceptDutySwapMutation.isSuccess ? (
            <Text style={styles.body}>Swap accepted.</Text>
          ) : null}
          {acceptDutySwapMutation.isError ? (
            <Text style={styles.body} accessibilityRole="alert">
              Swap is no longer available. Refresh and try again.
            </Text>
          ) : null}
        </View>
      )}
      <Text style={styles.body}>
        Fill-in {projection.fillInLabel ?? "None"}
      </Text>
      {loadFillInOptions === undefined ? null : (
        <View style={styles.fillInCard}>
          <Text style={styles.body}>Fill-in request</Text>
          {fillInOptions.isPending ? (
            <Text style={styles.body} accessibilityRole="progressbar">
              Checking for open requests
            </Text>
          ) : null}
          {fillInOptions.isError ? (
            <Text style={styles.body} accessibilityRole="alert">
              Fill-in options could not be loaded. Refresh and try again.
            </Text>
          ) : null}
          {fillInOptions.data?.request === null ? (
            <Text style={styles.body}>No open request</Text>
          ) : null}
          {fillInOptions.data?.request !== null &&
          fillInOptions.data?.request !== undefined ? (
            <>
              <Text style={styles.body}>
                A player is needed for this game. Choose a managed player to
                respond; team staff will confirm.
              </Text>
              {fillInOptions.data.players.map((player) => (
                <Pressable
                  key={player.playerId}
                  accessibilityRole="button"
                  accessibilityLabel={`Respond for ${player.displayName}`}
                  accessibilityState={{
                    disabled: fillInMutation.isPending,
                    busy: fillInMutation.isPending,
                  }}
                  disabled={fillInMutation.isPending}
                  onPress={() => {
                    const request = fillInOptions.data?.request;
                    if (request === null || request === undefined) return;
                    fillInMutation.mutate({
                      requestId: request.id,
                      playerId: player.playerId,
                    });
                  }}
                  style={styles.rsvpButton}
                >
                  <Text style={styles.body}>
                    Respond for {player.displayName}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {fillInMutation.isSuccess ? (
            <Text style={styles.body}>
              Response saved. Team staff will confirm.
            </Text>
          ) : null}
          {fillInMutation.isError ? (
            <Text style={styles.body} accessibilityRole="alert">
              Response could not be saved. Refresh and try again.
            </Text>
          ) : null}
        </View>
      )}
      {rsvpChoices.isPending && loadRsvpChoices !== undefined ? (
        <Text style={styles.body} accessibilityRole="progressbar">
          Loading your RSVP options
        </Text>
      ) : null}
      {rsvpChoices.isError ? (
        <Text style={styles.body} accessibilityRole="alert">
          Your RSVP options could not be loaded. Reconnect and try again.
        </Text>
      ) : null}
      {rsvpChoices.data?.map((choice) => (
        <View key={choice.playerId} style={styles.rsvpCard}>
          <Text style={styles.body}>{choice.name}</Text>
          <Text style={styles.body}>RSVP {choice.status}</Text>
          <View style={styles.rsvpActions}>
            {(["ATTENDING", "UNAVAILABLE", "UNSURE"] as const).map((status) => (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityLabel={`${choice.name}: ${status.toLowerCase()}`}
                accessibilityState={{
                  disabled: rsvpMutation.isPending,
                  selected: choice.status === status,
                }}
                disabled={rsvpMutation.isPending || saveRsvp === undefined}
                onPress={() => {
                  if (teamId === null || saveRsvp === undefined) return;
                  rsvpMutation.mutate({
                    teamId,
                    eventId: projection.eventId,
                    playerId: choice.playerId,
                    status,
                  });
                }}
                style={[
                  styles.rsvpButton,
                  choice.status === status ? styles.rsvpButtonSelected : null,
                ]}
              >
                <Text style={styles.body}>
                  {status === "ATTENDING"
                    ? "Attending"
                    : status === "UNAVAILABLE"
                      ? "Unavailable"
                      : "Unsure"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {rsvpMutation.isError ? (
        <Text style={styles.body} accessibilityRole="alert">
          RSVP could not be saved. Refresh and try again.
        </Text>
      ) : null}
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
