import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementsPanel } from "./announcements-panel";

const announcement = {
  id: "55555555-5555-4555-8555-555555555555",
  clubId: "11111111-1111-4111-8111-111111111111",
  teamId: "99999999-9999-4999-8999-999999999999",
  authorUserId: "19191919-1919-4919-8919-191919191919",
  category: "DUTY" as const,
  importance: "IMPORTANT" as const,
  title: "Canteen reminder",
  body: "Please arrive early.",
  acknowledgementRequired: true,
  publishedAt: "2026-10-07T00:00:00.000Z",
  archivedAt: null,
  readAt: null,
  acknowledgedAt: null,
  progressCount: 1,
};

describe("announcements panel", () => {
  it("shows a publisher the message and acknowledgement progress", () => {
    const html = renderToStaticMarkup(
      <AnnouncementsPanel
        clubId={announcement.clubId}
        teamId={announcement.teamId}
        announcements={[announcement]}
        canPublish
        publish={() => Promise.resolve()}
        acknowledge={() => Promise.resolve()}
        markRead={() => Promise.resolve()}
        archive={() => Promise.resolve()}
      />,
    );
    expect(html).toContain("Important: Canteen reminder");
    expect(html).toContain("Archive");
    expect(html).toContain("1 acknowledgements");
    expect(html).toContain("Publish announcement");
  });

  it("hides the composer from a reader", () => {
    const html = renderToStaticMarkup(
      <AnnouncementsPanel
        clubId={announcement.clubId}
        teamId={announcement.teamId}
        announcements={[
          { ...announcement, acknowledgedAt: announcement.publishedAt },
        ]}
        canPublish={false}
        publish={() => Promise.resolve()}
        acknowledge={() => Promise.resolve()}
        markRead={() => Promise.resolve()}
        archive={() => Promise.resolve()}
      />,
    );
    expect(html).not.toContain("Publish announcement");
    expect(html).not.toContain("Acknowledge");
  });
});
