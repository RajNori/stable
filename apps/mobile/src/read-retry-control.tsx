import { themeFor } from "@stable/design-tokens";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

const theme = themeFor("mustangs");

const styles = StyleSheet.create({
  action: {
    alignSelf: "flex-start",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingHorizontal: theme.space[3],
    borderColor: theme.color.border.default,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background.surface,
  },
  label: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.bodyMd.fontSize,
    lineHeight: theme.typeScale.bodyMd.lineHeight,
  },
});

export function ReadRetryControl({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Try again"
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
    >
      <Text style={styles.label}>Try again</Text>
    </Pressable>
  );
}
