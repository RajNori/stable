import { expect, test, type Page } from "@playwright/test";

const MEMBER_EMAIL = "member@local.stable.test";
const MEMBER_PASSWORD = "local-dev-password";

test.describe.configure({ mode: "serial", timeout: 60_000 });

test("email and password sign an adult into club administration", async ({
  page,
}) => {
  await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD);

  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Know what's next. Show up ready." }),
  ).toHaveCount(0);
  expect(page.url()).not.toContain(MEMBER_PASSWORD);
});

test("invalid credentials show a generic error without exposing credentials", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill("incorrect-local-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Sign-in could not be completed.")).toBeVisible();
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);
  expect(page.url()).not.toContain(MEMBER_EMAIL);
  expect(page.url()).not.toContain("incorrect-local-password");
});

test("sign out returns to the email sign-in entry", async ({ page }) => {
  await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD);
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Know what's next. Show up ready." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with email" }),
  ).toBeVisible();
});

async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
