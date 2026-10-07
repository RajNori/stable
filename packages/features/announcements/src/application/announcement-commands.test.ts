import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  acknowledgeAnnouncement,
  archiveAnnouncement,
  editAnnouncement,
  listAnnouncementProgress,
  listTeamAnnouncements,
  markAnnouncementRead,
  publishAnnouncement,
  type AnnouncementAccess,
  type AnnouncementWriter,
} from "./announcement-commands.js";
import { announcementMessages } from "./announcement-messages.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const userId = "19191919-1919-4919-8919-191919191919";

const principal: Principal = { userId, displayName: "Manager" };

function access(
  role: "TEAM_MANAGER" | "ASSISTANT_COACH" | "HEAD_COACH" | "GUARDIAN",
): AnnouncementAccess {
  if (role === "GUARDIAN") {
    return {
      principal,
      clubMemberships: [],
      teamMemberships: [],
      guardianLinks: [
        {
          clubId,
          playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          active: true,
          playerActive: true,
        },
      ],
      registrations: [
        {
          clubId,
          teamId,
          playerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          active: true,
          teamActive: true,
        },
      ],
      teamActive: true,
    };
  }
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [
      {
        clubId,
        teamId,
        role,
        active: true,
        teamActive: true,
      },
    ],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function writer(): AnnouncementWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    publishAnnouncement: (command) => {
      calls.push(`publish:${command.title}`);
      return Promise.resolve({
        announcementId: "55555555-5555-4555-8555-555555555555",
      });
    },
    editAnnouncement: () =>
      Promise.resolve({
        announcementId: "55555555-5555-4555-8555-555555555555",
      }),
    archiveAnnouncement: () =>
      Promise.resolve({
        announcementId: "55555555-5555-4555-8555-555555555555",
      }),
    listTeamAnnouncements: (input) => {
      calls.push(`list:${String(input.includeArchived)}`);
      return Promise.resolve([]);
    },
    markAnnouncementRead: () => Promise.resolve(),
    acknowledgeAnnouncement: () => {
      calls.push("ack");
      return Promise.resolve();
    },
    listAnnouncementAcknowledgements: () => Promise.resolve([]),
  };
}

const draft = {
  clubId,
  teamId,
  category: "GENERAL" as const,
  importance: "NORMAL" as const,
  title: "Bring water",
  body: "Saturday is hot.",
  acknowledgementRequired: true,
};

describe("announcements", () => {
  it("lets a manager publish and denies an assistant and a guardian", async () => {
    const managerWriter = writer();
    const published = await publishAnnouncement({
      ...access("TEAM_MANAGER"),
      ...draft,
      writer: managerWriter,
    });
    expect(published.announcementId).toBe(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(managerWriter.calls).toEqual(["publish:Bring water"]);

    const notified: string[] = [];
    await publishAnnouncement({
      ...access("HEAD_COACH"),
      ...draft,
      writer: writer(),
      notify: {
        announcementPublished: (published) => {
          notified.push(published.announcementId);
          return Promise.resolve();
        },
      },
    });
    expect(notified).toEqual(["55555555-5555-4555-8555-555555555555"]);

    const failedNotify = writer();
    const stillPublished = await publishAnnouncement({
      ...access("TEAM_MANAGER"),
      ...draft,
      writer: failedNotify,
      notify: {
        announcementPublished: () => Promise.reject(new Error("push down")),
      },
    });
    expect(stillPublished.announcementId).toBe(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(failedNotify.calls).toEqual(["publish:Bring water"]);

    await expect(
      publishAnnouncement({
        ...access("ASSISTANT_COACH"),
        ...draft,
        writer: writer(),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: announcementMessages.forbidden,
    });
    await expect(
      publishAnnouncement({
        ...access("GUARDIAN"),
        ...draft,
        writer: writer(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a title with a control character before writing", async () => {
    const calls = writer();
    await expect(
      publishAnnouncement({
        ...access("HEAD_COACH"),
        ...draft,
        title: "Bad\u0000title",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(calls.calls).toEqual([]);
  });

  it("hides archived announcements from a guardian", async () => {
    const calls = writer();
    await listTeamAnnouncements({
      ...access("GUARDIAN"),
      clubId,
      teamId,
      includeArchived: true,
      writer: calls,
    });
    expect(calls.calls).toEqual(["list:false"]);
  });

  it("lets a guardian acknowledge only through their own call", async () => {
    const calls = writer();
    await acknowledgeAnnouncement({
      ...access("GUARDIAN"),
      clubId,
      teamId,
      announcementId: "55555555-5555-4555-8555-555555555555",
      writer: calls,
    });
    expect(calls.calls).toEqual(["ack"]);
    expect(Object.keys(calls).includes("userId")).toBe(false);
  });

  it("lets a publisher include archived announcements", async () => {
    const calls = writer();
    await listTeamAnnouncements({
      ...access("HEAD_COACH"),
      clubId,
      teamId,
      includeArchived: true,
      writer: calls,
    });
    expect(calls.calls).toEqual(["list:true"]);
  });

  it("edits and archives only after the caller is signed in", async () => {
    const calls = writer();
    await editAnnouncement({
      ...access("TEAM_MANAGER"),
      announcementId: "55555555-5555-4555-8555-555555555555",
      category: "FIXTURE",
      importance: "IMPORTANT",
      title: "Time change",
      body: "Now 6pm.",
      acknowledgementRequired: false,
      writer: calls,
    });
    await archiveAnnouncement({
      ...access("TEAM_MANAGER"),
      announcementId: "55555555-5555-4555-8555-555555555555",
      writer: calls,
    });
    await markAnnouncementRead({
      ...access("GUARDIAN"),
      clubId,
      teamId,
      announcementId: "55555555-5555-4555-8555-555555555555",
      writer: calls,
    });
    await expect(
      archiveAnnouncement({
        ...access("TEAM_MANAGER"),
        principal: null,
        announcementId: "55555555-5555-4555-8555-555555555555",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      editAnnouncement({
        ...access("TEAM_MANAGER"),
        announcementId: "not-an-id",
        category: "FIXTURE",
        importance: "IMPORTANT",
        title: "Time change",
        body: "Now 6pm.",
        acknowledgementRequired: false,
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("lets a publisher read acknowledgement progress", async () => {
    const calls = writer();
    await listAnnouncementProgress({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      announcementId: "55555555-5555-4555-8555-555555555555",
      writer: calls,
    });
    await expect(
      listAnnouncementProgress({
        ...access("GUARDIAN"),
        clubId,
        teamId,
        announcementId: "55555555-5555-4555-8555-555555555555",
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an announcement id that is not a uuid", async () => {
    const calls = writer();
    const bad = {
      ...access("GUARDIAN"),
      clubId,
      teamId: "not-a-team",
      announcementId: "55555555-5555-4555-8555-555555555555",
      writer: calls,
    };
    await expect(
      listTeamAnnouncements({ ...bad, includeArchived: false }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(acknowledgeAnnouncement(bad)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      listAnnouncementProgress({ ...bad, ...access("TEAM_MANAGER") }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(markAnnouncementRead(bad)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      acknowledgeAnnouncement({ ...bad, teamId, clubId: "not-a-club" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      acknowledgeAnnouncement({
        ...bad,
        teamId,
        clubId,
        announcementId: "not-an-id",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("denies a signed-out caller before any write", async () => {
    const calls = writer();
    await expect(
      publishAnnouncement({
        ...access("TEAM_MANAGER"),
        principal: null,
        ...draft,
        writer: calls,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(calls.calls).toEqual([]);
  });
});
