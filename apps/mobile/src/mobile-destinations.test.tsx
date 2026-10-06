import React from "react";
import { Text } from "react-native";
import { render, screen, userEvent } from "@testing-library/react-native";

import { MobileDestinations } from "./mobile-destinations";

describe("mobile destinations", () => {
  it("keeps home, schedule, team, updates, and profile on one tab bar", async () => {
    await render(
      <MobileDestinations
        home={<Text>Mentone Mustangs</Text>}
        schedule={<Text>Training at Tuesday</Text>}
        team={<Text>Alexander R.</Text>}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Schedule")).toBeTruthy();
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getByText("Updates")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Mentone Mustangs")).toBeTruthy();

    await user.press(screen.getByRole("tab", { name: "Team" }));
    expect(screen.getByText("Alexander R.")).toBeTruthy();
    expect(screen.queryByText("Mentone Mustangs")).toBeNull();

    await user.press(screen.getByRole("tab", { name: "Schedule" }));
    expect(screen.getByText("Training at Tuesday")).toBeTruthy();
    expect(screen.queryByText("Alexander R.")).toBeNull();

    await user.press(screen.getByRole("tab", { name: "Updates" }));
    expect(screen.getByText("Updates is not available yet.")).toBeTruthy();

    await user.press(screen.getByRole("tab", { name: "Profile" }));
    expect(screen.getByText("Profile is not available yet.")).toBeTruthy();
  });
});
