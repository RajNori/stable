import { expect, test } from "@playwright/test";

import { openInvitationAcceptance } from "./invitation-handoff";
import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("roster names follow the caller's capability", async ({ browser }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString();
  const firstName = `Roster${suffix}`;
  const lastName = "Nguyen";
  const teamName = `Roster Team ${suffix}`;
  const masked = `${firstName} N.`;
  const registered = `${firstName} ${lastName}`;

  const memberContext = await browser.newContext();
  await applyLocalSession(memberContext, MEMBER_EMAIL);
  const member = await memberContext.newPage();
  await member.goto("/club-structure");
  await member.getByLabel("Season name").fill(`Roster Season ${suffix}`);
  await member.getByLabel("Team name").fill(teamName);
  await member.getByRole("button", { name: "Create season and team" }).click();
  const teamItem = member.getByRole("listitem").filter({ hasText: teamName });
  const rosterPath = await teamItem
    .getByRole("link", { name: "Roster", exact: true })
    .getAttribute("href");
  if (rosterPath === null) {
    throw new Error("Expected the new team to link to its roster.");
  }
  const staffPath = await teamItem
    .getByRole("link", { name: teamName, exact: true })
    .getAttribute("href");
  if (staffPath === null) {
    throw new Error("Expected the new team to link to its staff page.");
  }

  await member.goto("/players");

  const add = member.getByRole("region", { name: "Add player" });
  await add.getByLabel("Given name").fill(firstName);
  await add.getByLabel("Surname").fill(lastName);
  await add.getByRole("button", { name: "Add player" }).click();

  const item = member.getByRole("listitem").filter({ hasText: firstName });
  await item.getByLabel("Team").selectOption({ label: teamName });
  await item.getByRole("button", { name: "Register team" }).click();
  await expect(
    item.getByRole("button", { name: "Unregister team" }),
  ).toBeVisible();

  const outsiderContext = await browser.newContext();
  await applyLocalSession(outsiderContext, OUTSIDER_EMAIL);
  const outsider = await outsiderContext.newPage();
  await outsider.goto(rosterPath);
  await expect(outsider.getByText(firstName)).toHaveCount(0);
  await expect(outsider.getByText(lastName)).toHaveCount(0);
  await expect(
    outsider.getByRole("button", { name: "Register player", exact: true }),
  ).toHaveCount(0);

  await item.getByLabel("Invitation email").fill(OUTSIDER_EMAIL);
  await item.getByRole("button", { name: "Create invitation" }).click();
  const guardianLink = await item.getByLabel("Invitation link").inputValue();
  await openInvitationAcceptance(outsider, guardianLink);
  await outsider.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    outsider.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");

  await outsider.goto(rosterPath);
  await expect(outsider.getByRole("list", { name: "Roster" })).toContainText(
    masked,
  );
  await expect(outsider.getByText(registered)).toHaveCount(0);
  await expect(
    outsider.getByRole("button", { name: "Register player" }),
  ).toHaveCount(0);

  await member.goto(staffPath);
  await member.getByLabel("Invitation email").fill(OUTSIDER_EMAIL);
  await member
    .getByLabel("Invitation role")
    .selectOption({ label: "Head coach" });
  await member.getByRole("button", { name: "Create invitation" }).click();
  const staffLink = await member.getByLabel("Invitation link").inputValue();
  await openInvitationAcceptance(outsider, staffLink);
  await outsider.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    outsider.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");

  await outsider.goto(rosterPath);
  await expect(outsider.getByRole("list", { name: "Roster" })).toContainText(
    registered,
  );
  await expect(
    outsider.getByRole("button", { name: "Register player" }),
  ).toHaveCount(0);

  await member.goto(rosterPath);
  await expect(member.getByRole("list", { name: "Roster" })).toContainText(
    registered,
  );
  await expect(
    member.getByRole("button", { name: "Register player", exact: true }),
  ).toBeVisible();

  await memberContext.close();
  await outsiderContext.close();
});
