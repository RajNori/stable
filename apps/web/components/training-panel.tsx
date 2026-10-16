import { formatScheduleDateTime } from "@stable/schedule";
import { utcIsoToLocalDateTime } from "@stable/fixtures";
import type { TrainingEditMetadata } from "@stable/training";

export function TrainingPanel({
  clubId,
  teamId,
  timezone,
  sessions,
  canManage,
  canCheckIn,
  error,
  createSession,
  createSeries,
  checkIn,
  editTraining,
}: {
  clubId: string;
  teamId: string;
  timezone: string;
  sessions: {
    eventId: string;
    startsAt: string;
    endsAt: string | null;
    courtLabel: string | null;
    editMetadata: TrainingEditMetadata | null;
  }[];
  canManage: boolean;
  canCheckIn: boolean;
  error?: string | undefined;
  createSession: (formData: FormData) => Promise<void>;
  createSeries: (formData: FormData) => Promise<void>;
  checkIn: (formData: FormData) => Promise<void>;
  editTraining: (formData: FormData) => Promise<void>;
}) {
  return (
    <section aria-label="Training">
      <h2 style={{ margin: 0 }}>Training</h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {sessions.length === 0 ? <p>No training in this range.</p> : null}
      {sessions.map((session) => (
        <form action={checkIn} key={session.eventId}>
          <input type="hidden" name="clubId" value={clubId} />
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="eventId" value={session.eventId} />
          <p>
            Training at {formatScheduleDateTime(session.startsAt, timezone)}
          </p>
          {session.courtLabel ? <p>{session.courtLabel}</p> : null}
          {canCheckIn ? <button type="submit">Check in</button> : null}
        </form>
      ))}
      {canManage
        ? sessions.map((session) => {
            const metadata = session.editMetadata;
            if (metadata === null) return null;
            let startsAt = "";
            let endsAt = "";
            try {
              startsAt = utcIsoToLocalDateTime(session.startsAt, timezone);
              endsAt =
                session.endsAt === null
                  ? ""
                  : utcIsoToLocalDateTime(session.endsAt, timezone);
            } catch {
              // Leave invalid values blank so the form cannot silently shift time.
            }
            return (
              <details key={`edit-${session.eventId}`}>
                <summary>Edit training</summary>
                <p>
                  The one-practice option updates its date, time, duration, and
                  court. Recurring options update the weekday, local time, and
                  series end date.
                </p>
                <form action={editTraining}>
                  <input type="hidden" name="clubId" value={clubId} />
                  <input type="hidden" name="teamId" value={teamId} />
                  <input type="hidden" name="eventId" value={session.eventId} />
                  <input
                    type="hidden"
                    name="seriesId"
                    value={metadata.recurrenceSeriesId ?? ""}
                  />
                  <input
                    type="hidden"
                    name="leadCoachUserId"
                    value={metadata.leadCoachUserId ?? ""}
                  />
                  <label>
                    Apply changes to
                    <select name="scope" defaultValue="occurrence">
                      <option value="occurrence">This practice only</option>
                      {metadata.recurrenceSeriesId !== null ? (
                        <>
                          <option value="following">This and following</option>
                          <option value="series">Whole series</option>
                        </>
                      ) : null}
                    </select>
                  </label>
                  <label>
                    Starts
                    <input
                      name="startsAt"
                      type="datetime-local"
                      defaultValue={startsAt}
                      required
                    />
                  </label>
                  <label>
                    Ends (optional)
                    <input
                      name="endsAt"
                      type="datetime-local"
                      defaultValue={endsAt}
                    />
                  </label>
                  <label>
                    Court
                    <input
                      name="courtLabel"
                      defaultValue={session.courtLabel ?? ""}
                    />
                  </label>
                  {metadata.recurrenceSeriesId !== null ? (
                    <>
                      <label>
                        Weekday (1 Monday – 7 Sunday)
                        <input
                          name="weekday"
                          type="number"
                          min={1}
                          max={7}
                          defaultValue={metadata.weekday ?? 1}
                        />
                      </label>
                      <label>
                        Local time
                        <input
                          name="localTime"
                          type="time"
                          defaultValue={metadata.localTime ?? "18:30"}
                        />
                      </label>
                      <label>
                        Series ends on (optional)
                        <input
                          name="endsOn"
                          type="date"
                          defaultValue={metadata.endsOn ?? ""}
                        />
                      </label>
                    </>
                  ) : null}
                  <button type="submit">Save training changes</button>
                </form>
              </details>
            );
          })
        : null}
      {canManage ? (
        <>
          <form action={createSession}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="timezone" value={timezone} />
            <label>
              Starts
              <input name="startsAt" type="datetime-local" />
            </label>
            <label>
              Court
              <input name="courtLabel" />
            </label>
            <button type="submit">Add practice</button>
          </form>
          <form action={createSeries}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="timezone" value={timezone} />
            <label>
              Weekday
              <input
                name="weekday"
                type="number"
                min={1}
                max={7}
                defaultValue={1}
              />
            </label>
            <label>
              Time
              <input name="localTime" type="time" defaultValue="18:30" />
            </label>
            <label>
              Starts on
              <input name="startsOn" type="date" />
            </label>
            <label>
              Ends on
              <input name="endsOn" type="date" />
            </label>
            <button type="submit">Add weekly series</button>
          </form>
        </>
      ) : null}
    </section>
  );
}
