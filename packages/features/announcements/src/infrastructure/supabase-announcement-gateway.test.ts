import { describe, expect, it } from "vitest";

import { createSupabaseAnnouncementGateway } from "./supabase-announcement-gateway.js";

const row = {
  id: "55555555-5555-4555-8555-555555555555",
  club_id: "11111111-1111-4111-8111-111111111111",
  team_id: "99999999-9999-4999-8999-999999999999",
  author_user_id: "19191919-1919-4919-8919-191919191919",
  category: "GENERAL",
  importance: "NORMAL",
  title: "Bring water",
  body: "Saturday is hot.",
  acknowledgement_required: true,
  published_at: "2026-10-07T00:00:00+00:00",
  archived_at: null,
  read_at: null,
  acknowledged_at: null,
};

function client(result: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: () => Promise.resolve(result),
  };
}

describe("announcement gateway", () => {
  it("normalizes a published announcement", async () => {
    const gateway = createSupabaseAnnouncementGateway(
      client({ data: row.id, error: null }),
    );
    const published = await gateway.publishAnnouncement({
      clubId: row.club_id,
      teamId: row.team_id,
      category: "GENERAL",
      importance: "NORMAL",
      title: row.title,
      body: row.body,
      acknowledgementRequired: true,
    });
    expect(published.announcementId).toBe(row.id);
  });

  it("maps stable database errors", async () => {
    const codes = [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_FAILED",
      "CONFLICT",
      "SOMETHING_ELSE",
    ] as const;
    for (const code of codes) {
      const gateway = createSupabaseAnnouncementGateway(
        client({ data: null, error: { message: code } }),
      );
      await expect(
        gateway.acknowledgeAnnouncement(row.id),
      ).rejects.toMatchObject({
        code: code === "SOMETHING_ELSE" ? "INTERNAL" : code,
      });
    }
  });

  it("edits, archives, and lists acknowledgement progress", async () => {
    const gateway = createSupabaseAnnouncementGateway(
      client({ data: row.id, error: null }),
    );
    await expect(
      gateway.editAnnouncement({
        announcementId: row.id,
        category: "TRAINING",
        importance: "IMPORTANT",
        title: "Moved",
        body: "Indoor court.",
        acknowledgementRequired: false,
      }),
    ).resolves.toEqual({ announcementId: row.id });
    await expect(gateway.archiveAnnouncement(row.id)).resolves.toEqual({
      announcementId: row.id,
    });

    const progress = createSupabaseAnnouncementGateway(
      client({
        data: [
          {
            user_id: row.author_user_id,
            acknowledged_at: "not-a-date",
          },
        ],
        error: null,
      }),
    );
    const rows = await progress.listAnnouncementAcknowledgements(row.id);
    expect(rows[0]?.acknowledgedAt).toBe("not-a-date");

    const empty = createSupabaseAnnouncementGateway(
      client({ data: null, error: null }),
    );
    await expect(
      empty.listTeamAnnouncements({
        teamId: row.team_id,
        includeArchived: true,
      }),
    ).resolves.toEqual([]);
    await expect(
      empty.publishAnnouncement({
        clubId: row.club_id,
        teamId: row.team_id,
        category: "DUTY",
        importance: "NORMAL",
        title: "Score",
        body: "Bring the sheet.",
        acknowledgementRequired: false,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("reads rows and rejects an unexpected payload", async () => {
    const gateway = createSupabaseAnnouncementGateway(
      client({ data: [row], error: null }),
    );
    const listed = await gateway.listTeamAnnouncements({
      teamId: row.team_id,
      includeArchived: false,
    });
    expect(listed[0]?.publishedAt).toBe("2026-10-07T00:00:00.000Z");

    const stamped = createSupabaseAnnouncementGateway(
      client({
        data: [
          {
            ...row,
            published_at: "not-a-date",
            archived_at: "2026-10-08T00:00:00+00:00",
            read_at: "2026-10-07T01:00:00+00:00",
            acknowledged_at: "2026-10-07T02:00:00+00:00",
          },
        ],
        error: null,
      }),
    );
    const stampedRows = await stamped.listTeamAnnouncements({
      teamId: row.team_id,
      includeArchived: true,
    });
    expect(stampedRows[0]?.publishedAt).toBe("not-a-date");
    expect(stampedRows[0]?.archivedAt).toBe("2026-10-08T00:00:00.000Z");

    const broken = createSupabaseAnnouncementGateway(
      client({ data: [{ id: "nope" }], error: null }),
    );
    await expect(
      broken.listAnnouncementAcknowledgements(row.id),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      broken.listTeamAnnouncements({
        teamId: row.team_id,
        includeArchived: false,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(gateway.markAnnouncementRead(row.id)).resolves.toBeUndefined();

    const prefixed = createSupabaseAnnouncementGateway(
      client({ data: null, error: { message: "42501: FORBIDDEN" } }),
    );
    await expect(prefixed.markAnnouncementRead(row.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
