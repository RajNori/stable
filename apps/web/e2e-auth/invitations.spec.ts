import { expect, test } from "@playwright/test";

import {
  openInvitationAcceptance,
  watchAcceptancePost,
} from "./invitation-handoff";
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
  await member.goto("/players");
  await expect(
    member.getByRole("listitem").filter({ hasText: firstName }),
  ).toContainText("pending");

  const token = await openInvitationAcceptance(member, link);
  await member.reload();
  await expect(
    member.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation was not found.");
  expect(member.url().includes(token)).toBe(false);

  await openInvitationAcceptance(member, link);
  const memberMismatch = watchAcceptancePost(member, token);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    member.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("does not match the signed-in account");
  memberMismatch();

  const outsiderContext = await browser.newContext();
  await applyLocalSession(outsiderContext, OUTSIDER_EMAIL);
  const outsider = await outsiderContext.newPage();
  await openInvitationAcceptance(outsider, link);
  const outsiderAccept = watchAcceptancePost(outsider, token);
  await outsider.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    outsider.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");
  outsiderAccept();

  await openInvitationAcceptance(member, link);
  const memberReplay = watchAcceptancePost(member, token);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    member.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("already been used");
  memberReplay();

  await memberContext.close();
  await outsiderContext.close();
});

test("missing and malformed invitation fragments fail closed", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  const region = page.getByRole("region", { name: "Accept invitation" });

  await page.goto("/invitations/accept");
  await expect(region).toContainText("Invitation was not found.");

  await page.goto("/invitations/accept#not-a-token");
  await expect(region).toContainText("Invitation was not found.");
  await expect.poll(() => page.url()).not.toContain("not-a-token");

  const crafted = "11".repeat(32);
  page.on("response", (response) => {
    if (response.status() < 300 || response.status() >= 400) {
      return;
    }
    const location = response.headers()["location"] ?? "";
    expect(location.includes(crafted)).toBe(false);
  });
  await page.goto(`/invitations/accept?token=${crafted}`);
  await expect(region).toContainText("Invitation was not found.");
  expect(page.url().includes(crafted)).toBe(false);
  expect(page.url().includes("?token=")).toBe(false);
  expect((await page.content()).includes(crafted)).toBe(false);

  await context.close();
});
