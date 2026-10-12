import { themeFor } from "@stable/design-tokens";
import type { CurrentClubContext } from "@stable/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DESTINATIONS = [
  "Home",
  "Schedule",
  "Team",
  "Updates",
  "Profile",
] as const;

export type MobileDestination = (typeof DESTINATIONS)[number];

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
  contextPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
  },
});

export function MobileDestinations({
  loadContext,
  home,
  schedule,
  team,
  updates,
  profile,
}: {
  loadContext?: (() => Promise<CurrentClubContext>) | undefined;
  home:
    | React.ReactNode
    | ((
        navigate: (destination: MobileDestination) => void,
        loadContext: () => Promise<CurrentClubContext>,
      ) => React.ReactNode);
  schedule:
    | React.ReactNode
    | ((loadContext: () => Promise<CurrentClubContext>) => React.ReactNode);
  team:
    | React.ReactNode
    | ((loadContext: () => Promise<CurrentClubContext>) => React.ReactNode);
  updates?:
    | React.ReactNode
    | ((loadContext: () => Promise<CurrentClubContext>) => React.ReactNode)
    | undefined;
  profile?:
    | React.ReactNode
    | ((loadContext: () => Promise<CurrentClubContext>) => React.ReactNode)
    | undefined;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MobileDestination>("Home");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [switchingTeam, setSwitchingTeam] = useState(false);
  const context = useQuery({
    queryKey: ["mobile-destination-context"],
    queryFn: () => {
      if (loadContext === undefined) throw new Error("Context is unavailable");
      return loadContext();
    },
    enabled: loadContext !== undefined,
    retry: false,
  });
  const baseContext = context.data;
  const availableTeams = baseContext?.availableTeams ?? [];
  const defaultTeamId =
    baseContext?.activeTeam?.id ??
    (availableTeams.length === 1 ? availableTeams[0]?.id : null);
  const activeTeamId = availableTeams.some((team) => team.id === selectedTeamId)
    ? selectedTeamId
    : defaultTeamId;
  const scopedLoadContext = async (): Promise<CurrentClubContext> => {
    const source = baseContext ?? (await loadContext?.());
    if (source === undefined) throw new Error("Context is unavailable");
    const activeTeam =
      source.availableTeams.find((team) => team.id === activeTeamId) ??
      (source.activeTeam?.id === activeTeamId ? source.activeTeam : null);
    return { ...source, activeTeam };
  };

  async function switchTeam(teamId: string): Promise<void> {
    if (teamId === activeTeamId || switchingTeam) return;
    setSwitchingTeam(true);
    await queryClient.cancelQueries();
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "mobile-destination-context",
    });
    await queryClient.invalidateQueries({
      queryKey: ["mobile-destination-context"],
    });
    setSelectedTeamId(teamId);
    setSwitchingTeam(false);
  }

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
      {availableTeams.length > 1 ? (
        <View accessibilityRole="radiogroup" style={styles.contextPicker}>
          {availableTeams.map((team) => (
            <Pressable
              key={team.id}
              accessibilityRole="radio"
              accessibilityLabel={team.name}
              accessibilityState={{
                checked: activeTeamId === team.id,
                disabled: switchingTeam,
              }}
              disabled={switchingTeam}
              onPress={() => void switchTeam(team.id)}
              style={styles.tab}
            >
              <Text style={styles.label}>{team.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {switchingTeam ? (
        <Text accessibilityRole="progressbar" style={styles.placeholder}>
          Switching team
        </Text>
      ) : null}
      {selected === "Home"
        ? switchingTeam
          ? null
          : typeof home === "function"
            ? home(setSelected, scopedLoadContext)
            : home
        : null}
      {selected === "Schedule"
        ? switchingTeam
          ? null
          : typeof schedule === "function"
            ? schedule(scopedLoadContext)
            : schedule
        : null}
      {selected === "Team"
        ? switchingTeam
          ? null
          : typeof team === "function"
            ? team(scopedLoadContext)
            : team
        : null}
      {selected === "Updates"
        ? switchingTeam
          ? null
          : typeof updates === "function"
            ? updates(scopedLoadContext)
            : (updates ?? (
                <Text accessibilityRole="header" style={styles.placeholder}>
                  Updates is not available yet.
                </Text>
              ))
        : null}
      {selected === "Profile"
        ? typeof profile === "function"
          ? profile(scopedLoadContext)
          : (profile ?? (
              <Text accessibilityRole="header" style={styles.placeholder}>
                Profile is not available yet.
              </Text>
            ))
        : null}
    </View>
  );
}
