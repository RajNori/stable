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
}: {
  clubId: string;
  teamId: string;
  timezone: string;
  sessions: { eventId: string; startsAt: string }[];
  canManage: boolean;
  canCheckIn: boolean;
  error?: string | undefined;
  createSession: (formData: FormData) => Promise<void>;
  createSeries: (formData: FormData) => Promise<void>;
  checkIn: (formData: FormData) => Promise<void>;
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
          <p>Training at {session.startsAt}</p>
          {canCheckIn ? <button type="submit">Check in</button> : null}
        </form>
      ))}
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
