import { expect, test } from "@playwright/test";

test("club admin player management shows the registered name and safe display name", async ({
  page,
}) => {
  await page.goto("/players?fixture=member");

  await expect(
    page.getByRole("region", { name: "Players", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Alexander Robertson")).toBeVisible();
  await expect(
    page.getByText("Guardian display name: Alexander R."),
  ).toBeVisible();
  await page.getByText("Manage profile and access").click();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByLabel("Club adult").first()).toContainText(
    "Local Member",
  );
});

test("outsider does not see player management", async ({ page }) => {
  await page.goto("/players?fixture=outsider");

  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "no-membership",
  );
  await expect(
    page.getByRole("region", { name: "Players", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "People" })).toHaveCount(0);
});
