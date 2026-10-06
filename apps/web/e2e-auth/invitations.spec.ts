import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("a guardian invitation is one-time and identity-bound", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString();
  const firstName = `Invite${suffix}`;
  const memberContext = await browser.newContext();
  await applyLocalSession(memberContext, MEMBER_EMAIL);
  const member = await memberContext.newPage();
  await member.goto("/players");

  const add = member.getByRole("region", { name: "Add player" });
  await add.getByLabel("Given name").fill(firstName);
  await add.getByLabel("Surname").fill("Child");
  await add.getByRole("button", { name: "Add player" }).click();

  const item = member.getByRole("listitem").filter({ hasText: firstName });
  await item.getByLabel("Invitation email").fill(OUTSIDER_EMAIL);
  await item.getByRole("button", { name: "Create invitation" }).click();
  const link = await item.getByLabel("Invitation link").inputValue();
  expect(link).toContain("/invitations/accept?token=");
  await member.goto("/players");
  await expect(
    member.getByRole("listitem").filter({ hasText: firstName }),
  ).toContainText("pending");

  await member.goto(link);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    member.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("does not match the signed-in account");

  const outsiderContext = await browser.newContext();
  await applyLocalSession(outsiderContext, OUTSIDER_EMAIL);
  const outsider = await outsiderContext.newPage();
  await outsider.goto(link);
  await outsider.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    outsider.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");

  await member.goto(link);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    member.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("already been used");

  await memberContext.close();
  await outsiderContext.close();
});
