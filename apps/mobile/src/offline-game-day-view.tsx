import { themeFor } from "@stable/design-tokens";
import React, { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  gameDaySnapshotFreshness,
  type GameDaySnapshot,
} from "./game-day-snapshot";
import { formatScheduleDateTime } from "@stable/schedule";
import { ReadRetryControl } from "./read-retry-control";

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
  onRefresh,
  refreshing = false,
}: {
  snapshot: GameDaySnapshot | null;
  now: number;
  onRefresh?: (() => void) | undefined;
  refreshing?: boolean | undefined;
}) {
  const freshness =
    snapshot === null ? null : gameDaySnapshotFreshness(snapshot.savedAt, now);
  const savedAt =
    snapshot?.timezone === undefined
      ? "before the latest app update"
      : formatScheduleDateTime(snapshot.savedAt, snapshot.timezone);
  const statusAnnouncement =
    snapshot === null
      ? null
      : `Offline. Last updated ${savedAt}${freshness === "stale" ? ". This snapshot is stale." : "."}`;

  useEffect(() => {
    if (Platform.OS === "ios" && statusAnnouncement !== null) {
      AccessibilityInfo.announceForAccessibility(statusAnnouncement);
    }
  }, [statusAnnouncement]);

  if (snapshot === null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>No game day saved on this device.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {snapshot.teamName}: {snapshot.opponentName}
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        Offline · Last updated {savedAt}
      </Text>
      <Text style={styles.body}>
        Official start{" "}
        {snapshot.timezone === undefined
          ? "Time unavailable offline"
          : formatScheduleDateTime(snapshot.officialStartAt, snapshot.timezone)}
      </Text>
      <Text style={styles.body}>
        Arrival{" "}
        {snapshot.arrivalAt === null
          ? "Not set"
          : snapshot.timezone === undefined
            ? "Time unavailable offline"
            : formatScheduleDateTime(snapshot.arrivalAt, snapshot.timezone)}
      </Text>
      <Text style={styles.body}>Venue {snapshot.venueText ?? "Not set"}</Text>
      <Text style={styles.body}>Court {snapshot.courtLabel ?? "Not set"}</Text>
      <Text style={styles.body}>
        Uniform {snapshot.uniformNote ?? "Not set"}
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
      {onRefresh === undefined ? null : (
        <ReadRetryControl onPress={onRefresh} disabled={refreshing} />
      )}
      <Text accessibilityState={{ disabled: true }} style={styles.body}>
        Save RSVP
      </Text>
      <Text accessibilityState={{ disabled: true }} style={styles.body}>
        Check in
      </Text>
    </View>
  );
}
