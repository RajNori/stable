import type { AnnouncementRecord } from "@stable/announcements";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_IMPORTANCE,
} from "@stable/announcements";

export function AnnouncementsPanel({
  clubId,
  teamId,
  announcements,
  canPublish,
  error,
  publish,
  acknowledge,
  markRead,
  archive,
}: {
  clubId: string;
  teamId: string;
  announcements: readonly (AnnouncementRecord & { progressCount: number })[];
  canPublish: boolean;
  error?: string;
  publish: (formData: FormData) => Promise<void>;
  acknowledge: (formData: FormData) => Promise<void>;
  markRead: (formData: FormData) => Promise<void>;
  archive: (formData: FormData) => Promise<void>;
}) {
  return (
    <section aria-label="Announcements">
      <h2 style={{ margin: 0 }}>Announcements</h2>
      {error === undefined ? null : <p role="alert">{error}</p>}
      {announcements.length === 0 ? <p>No announcements.</p> : null}
      <ul>
        {announcements.map((announcement) => (
          <li key={announcement.id}>
            <p>
              {announcement.importance === "IMPORTANT" ? "Important: " : ""}
              {announcement.title}
            </p>
            <p>{announcement.body}</p>
            <p>{announcement.category}</p>
            {canPublish ? (
              <>
                <p>{`${String(announcement.progressCount)} acknowledgements`}</p>
                <form action={archive}>
                  <input type="hidden" name="clubId" value={clubId} />
                  <input type="hidden" name="teamId" value={teamId} />
                  <input
                    type="hidden"
                    name="announcementId"
                    value={announcement.id}
                  />
                  <button type="submit">Archive</button>
                </form>
              </>
            ) : null}
            <form action={markRead}>
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="teamId" value={teamId} />
              <input
                type="hidden"
                name="announcementId"
                value={announcement.id}
              />
              <button type="submit">Mark read</button>
            </form>
            {announcement.acknowledgementRequired &&
            announcement.acknowledgedAt === null ? (
              <form action={acknowledge}>
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="teamId" value={teamId} />
                <input
                  type="hidden"
                  name="announcementId"
                  value={announcement.id}
                />
                <button type="submit">Acknowledge</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canPublish ? (
        <form action={publish}>
          <input type="hidden" name="clubId" value={clubId} />
          <input type="hidden" name="teamId" value={teamId} />
          <label htmlFor="announcement-title">
            Title
            <input id="announcement-title" name="title" required />
          </label>
          <label htmlFor="announcement-body">
            Message
            <textarea id="announcement-body" name="body" required />
          </label>
          <label htmlFor="announcement-category">
            Category
            <select
              id="announcement-category"
              name="category"
              defaultValue="GENERAL"
            >
              {ANNOUNCEMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="announcement-importance">
            Importance
            <select
              id="announcement-importance"
              name="importance"
              defaultValue="NORMAL"
            >
              {ANNOUNCEMENT_IMPORTANCE.map((importance) => (
                <option key={importance} value={importance}>
                  {importance}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="announcement-ack">
            <input
              id="announcement-ack"
              name="acknowledgementRequired"
              type="checkbox"
            />
            Acknowledgement required
          </label>
          <button type="submit">Publish announcement</button>
        </form>
      ) : null}
    </section>
  );
}
