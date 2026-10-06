import { themeFor } from "@stable/design-tokens";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DESTINATIONS = [
  "Home",
  "Schedule",
  "Team",
  "Updates",
  "Profile",
] as const;

type Destination = (typeof DESTINATIONS)[number];

const theme = themeFor("mustangs");

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  tab: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.labelLg.fontSize,
    lineHeight: theme.typeScale.labelLg.lineHeight,
  },
  placeholder: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.headingMd.fontSize,
    lineHeight: theme.typeScale.headingMd.lineHeight,
    paddingHorizontal: theme.space[4],
  },
});

export function MobileDestinations({
  home,
  schedule,
  team,
}: {
  home: React.ReactNode;
  schedule: React.ReactNode;
  team: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Destination>("Home");

  return (
    <View style={styles.screen}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {DESTINATIONS.map((destination) => (
          <Pressable
            key={destination}
            accessibilityRole="tab"
            accessibilityLabel={destination}
            accessibilityState={{ selected: selected === destination }}
            onPress={() => {
              setSelected(destination);
            }}
            style={styles.tab}
          >
            <Text style={styles.label}>{destination}</Text>
          </Pressable>
        ))}
      </View>
      {selected === "Home" ? home : null}
      {selected === "Schedule" ? schedule : null}
      {selected === "Team" ? team : null}
      {selected === "Updates" || selected === "Profile" ? (
        <Text accessibilityRole="header" style={styles.placeholder}>
          {`${selected} is not available yet.`}
        </Text>
      ) : null}
    </View>
  );
}
