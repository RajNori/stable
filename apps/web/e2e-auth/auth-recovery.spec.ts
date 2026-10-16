import { expect, test, type Page } from "@playwright/test";

const MEMBER_EMAIL = "member@local.stable.test";
const MEMBER_PASSWORD = "local-dev-password";

test("password recovery uses the configured callback and neutral confirmation", async ({
  page,
}) => {
  let requestedRedirect: string | null = null;
  await page.route("**/auth/v1/recover**", async (route) => {
    requestedRedirect = new URL(route.request().url()).searchParams.get(
      "redirect_to",
    );
    await route.fulfill({ status: 400, json: { msg: "User not found" } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill("unknown@local.stable.test");
  await page.getByRole("button", { name: "Send recovery link" }).click();

  await expect(
    page.getByText(/If an account can sign in with that address/u),
  ).toBeVisible();
  expect(requestedRedirect).toBe(
    "http://127.0.0.1:3000/auth/callback?type=recovery",
  );
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);
});

test("a rejected callback can recover through normal email/password sign-in", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=stale-local-callback-code");
  await expect(page).toHaveURL(/\/?auth=validation$/u);
  await expect(
    page.getByText("The sign-in details could not be checked."),
  ).toBeVisible();
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);

  await signIn(page);
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(page.url()).not.toContain("stale-local-callback-code");
});

test("a transient auth network failure can recover through explicit retry", async ({
  page,
}) => {
  let passwordRequests = 0;
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    passwordRequests += 1;
    if (passwordRequests === 1) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(MEMBER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Sign-in could not be completed.")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(MEMBER_EMAIL);
  await expect(page.getByTestId("club-admin-frame")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("club-admin-frame")).toBeVisible();
  expect(passwordRequests).toBe(2);
});

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(MEMBER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}
