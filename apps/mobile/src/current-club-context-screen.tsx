import { ApplicationError } from "@stable/contracts";
import type { CurrentClubContext } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const MIN_TOUCH_TARGET_PT = 44;
const theme = themeFor("mustangs");

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.background.canvas,
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
  primary: {
    minHeight: MIN_TOUCH_TARGET_PT,
    minWidth: MIN_TOUCH_TARGET_PT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space[4],
    backgroundColor: theme.color.brand.accent,
    borderRadius: theme.radius.md,
  },
  primaryLabel: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.labelLg.fontSize,
    lineHeight: theme.typeScale.labelLg.lineHeight,
    fontWeight: "600",
  },
});

function PrimaryControl({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.primary}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApplicationError && error.code === "UNAUTHENTICATED";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return error.message;
  }

  return "Club context could not be loaded.";
}

export function CurrentClubContextScreen({
  loadContext,
}: {
  loadContext: () => Promise<CurrentClubContext>;
}) {
  const query = useQuery({
    queryKey: ["current-club-context"],
    queryFn: loadContext,
    retry: false,
  });

  function reload(): void {
    void query.refetch();
  }

  if (query.isPending) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        accessibilityLabel="Loading club"
        style={styles.screen}
      >
        <Text style={styles.body}>Loading club</Text>
      </View>
    );
  }

  if (query.isError && isUnauthenticated(query.error)) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Sign in to see your club.
        </Text>
      </View>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {errorMessage(query.error)}
        </Text>
        <PrimaryControl label="Try again" onPress={reload} />
      </View>
    );
  }

  const context = query.data;
  if (context.club === null) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          No club membership
        </Text>
        <Text style={styles.body}>{context.displayName}</Text>
        <PrimaryControl label="Refresh club" onPress={reload} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {context.club.name}
      </Text>
      <Text style={styles.body}>{context.displayName}</Text>
      {context.activeTeam === null ? null : (
        <Text style={styles.body}>{context.activeTeam.name}</Text>
      )}
      {context.availableTeams.length > 1
        ? context.availableTeams.map((team) => (
            <Text key={team.id} style={styles.body}>
              {team.name}
            </Text>
          ))
        : null}
      <Text style={styles.body}>
        {`Managed players: ${context.managedPlayerIds.length}`}
      </Text>
      {context.capabilities.map((capability) => (
        <Text key={capability} style={styles.body}>
          {capability}
        </Text>
      ))}
      <PrimaryControl label="Refresh club" onPress={reload} />
    </View>
  );
}
