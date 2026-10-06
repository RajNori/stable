import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import type { TeamRoster } from "@stable/roster";
import { rosterMessages } from "@stable/roster";
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
  return rosterMessages.readFailed;
}

export function TeamRosterScreen({
  loadContext,
  loadRoster,
}: {
  loadContext: () => Promise<CurrentClubContext>;
  loadRoster: (teamId: string) => Promise<TeamRoster>;
}) {
  const context = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });
  const teamId =
    context.data?.club === null ? null : (context.data?.activeTeam?.id ?? null);
  const roster = useQuery({
    queryKey: ["team-roster", teamId],
    queryFn: () => {
      if (teamId === null) {
        throw new Error(rosterMessages.readFailed);
      }
      return loadRoster(teamId);
    },
    enabled: teamId !== null,
    retry: false,
  });

  if (context.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading team</Text>
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
          {context.isError ? message(context.error) : rosterMessages.forbidden}
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

  if (roster.isPending) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>Loading team</Text>
      </View>
    );
  }

  if (roster.isError || roster.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {message(roster.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {context.data.activeTeam.name}
      </Text>
      {roster.data.entries.map((entry) => (
        <Text key={entry.playerId} style={styles.body}>
          {entry.name}
        </Text>
      ))}
    </View>
  );
}
