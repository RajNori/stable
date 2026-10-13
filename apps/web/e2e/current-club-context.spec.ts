import { expect, test } from "@playwright/test";

test("member sees club context without developer-facing capability names", async ({
  page,
}) => {
  await page.goto("/?fixture=member");

  const frame = page.getByTestId("club-admin-frame");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box?.width).toBeGreaterThan(1000);

  await expect(
    page.locator("header").getByText("Mentone Mustangs", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Jordan P")).toHaveCount(0);
  await expect(page.getByText("club.read")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Club structure", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "People", exact: true }),
  ).toBeVisible();
});

test("outsider sees no membership even with hidden admin chrome", async ({
  page,
}) => {
  await page.goto("/?fixture=outsider");

  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "no-membership",
  );
  await expect(page.getByRole("status")).toContainText(
    "active club membership",
  );
  await expect(page.getByText("Sam Outsider")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mentone Mustangs" }),
  ).toHaveCount(0);
  await expect(page.getByText("club.read")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Club structure", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "People", exact: true }),
  ).toHaveCount(0);
});

test("unauthenticated visitor is asked to sign in", async ({ page }) => {
  await page.goto("/?fixture=unauthenticated");

  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "unauthenticated",
  );
  await expect(page.getByRole("status")).toContainText(
    "Authentication is required.",
  );
  await expect(page.getByText(/Sign in with the email address/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Club structure", exact: true }),
  ).toHaveCount(0);
});
