import type { Locator } from "@playwright/test";

export async function openPlayerManagement(player: Locator): Promise<void> {
  const details = player.locator("details");
  if ((await details.getAttribute("open")) === null) {
    await details.locator("summary").click();
  }
}
