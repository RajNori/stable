import { expect, test } from "@playwright/test";

test("club workspace stays usable across desktop, tablet and phone widths", async ({
  page,
}) => {
  await page.goto("/?fixture=member");

  const frame = page.getByTestId("club-admin-frame");
  await expect(frame).toBeVisible();
  await expect(page.getByText("Current club")).toBeVisible();
  await expect(
    page.locator("header").getByText("Mentone Mustangs", { exact: true }),
  ).toBeVisible();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.locator(
    "button[aria-controls='stable-primary-navigation']",
  );
  const openToggle = page.getByRole("button", { name: "Open navigation" });
  await expect(openToggle).toBeVisible();
  await openToggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const sidebar = page.getByRole("complementary", {
    name: "Club administration",
  });
  const brandHome = sidebar.getByRole("link", { name: "The Stable home" });
  const overview = nav.getByRole("link", { name: "Overview", exact: true });
  const clubStructure = nav.getByRole("link", {
    name: "Club structure",
    exact: true,
  });
  const people = nav.getByRole("link", { name: "People", exact: true });
  await expect(overview).toBeVisible();
  await expect(clubStructure).toBeVisible();
  await expect(people).toBeVisible();
  await expect(overview).toHaveAttribute("aria-current", "page");
  await expect(overview).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(brandHome).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    nav.getByRole("link", { name: "Operational audit", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(brandHome).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});
