import { expect, test } from "@playwright/test";

test("club overview fits a phone viewport and keeps navigation keyboard-accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=member");

  const context = page.getByLabel("Club context");
  await expect(context).toHaveAttribute("data-state", "member");
  await expect(
    page.getByRole("heading", { name: "Mentone Mustangs" }),
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Admin sections" });
  const overviewLink = nav.getByRole("link", { name: "Overview", exact: true });
  const clubStructureLink = nav.getByRole("link", {
    name: "Club structure",
    exact: true,
  });
  const playersLink = nav.getByRole("link", { name: "Players", exact: true });
  await expect(overviewLink).toBeVisible();
  await expect(clubStructureLink).toBeVisible();
  await expect(playersLink).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.viewport).toBe(390);
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);

  await page.keyboard.press("Tab");
  await expect(overviewLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(clubStructureLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(playersLink).toBeFocused();
});
