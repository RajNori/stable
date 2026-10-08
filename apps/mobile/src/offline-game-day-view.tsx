import { themeFor } from "@stable/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  gameDaySnapshotFreshness,
  type GameDaySnapshot,
} from "./game-day-snapshot";

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

export function OfflineGameDayView({
  snapshot,
  now,
}: {
  snapshot: GameDaySnapshot | null;
  now: number;
}) {
  if (snapshot === null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>No game day saved on this device.</Text>
      </View>
    );
  }

  const freshness = gameDaySnapshotFreshness(snapshot.savedAt, now);
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {snapshot.teamName}: {snapshot.opponentName}
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        Offline · Last updated {snapshot.savedAt}
      </Text>
      {freshness === "stale" ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          This snapshot is stale.
        </Text>
      ) : null}
      <Text style={styles.body}>RSVP {snapshot.ownRsvp}</Text>
      <Text style={styles.body}>Duty {snapshot.ownDutyLabel ?? "None"}</Text>
      <Text style={styles.body}>Fill-in {snapshot.fillInLabel ?? "None"}</Text>
      {snapshot.attendingCount === null ? null : (
        <Text style={styles.body}>
          Attending {snapshot.attendingCount}, unanswered{" "}
          {snapshot.unansweredCount}
        </Text>
      )}
      <Text style={styles.body}>
        Reconnect to update RSVP, attendance, fixtures, duties, or check-in.
      </Text>
      <Text accessibilityState={{ disabled: true }} style={styles.body}>
        Save RSVP
      </Text>
      <Text accessibilityState={{ disabled: true }} style={styles.body}>
        Check in
      </Text>
    </View>
  );
}
