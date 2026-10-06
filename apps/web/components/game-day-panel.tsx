import type { GameDayProjection } from "@stable/game-day";

export function GameDayPanel({
  projection,
  error,
  players = [],
  recordAction,
}: {
  projection: GameDayProjection | null;
  error?: string | undefined;
  players?: { playerId: string; label: string }[] | undefined;
  recordAction?: ((formData: FormData) => Promise<void>) | undefined;
}) {
  return (
    <section aria-label="Game day">
      <h2 style={{ margin: 0 }}>Game day</h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {projection === null ? null : (
        <>
          <p>
            {projection.roundLabel ?? "Game"}: {projection.opponentName}
          </p>
          <p>Official start {projection.officialStartAt}</p>
          <p>Arrival {projection.arrivalAt ?? "Not set"}</p>
          <p>Venue {projection.venueText ?? "Not set"}</p>
          <p>Court {projection.courtLabel ?? "Not set"}</p>
          <p>Uniform {projection.uniformNote ?? "Not set"}</p>
          <p>Coach note {projection.coachFocus ?? "Not set"}</p>
          <p>RSVP {projection.ownRsvp}</p>
          <p>Duty {projection.ownDutyLabel ?? "None"}</p>
          {projection.attendingCount === null ? null : (
            <p>
              Attending {projection.attendingCount}, unavailable{" "}
              {projection.unavailableCount}, unsure {projection.unsureCount},
              unanswered {projection.unansweredCount}
            </p>
          )}
          {recordAction === undefined
            ? null
            : players.map((player) => (
                <form action={recordAction} key={player.playerId}>
                  <input
                    type="hidden"
                    name="clubId"
                    value={projection.clubId}
                  />
                  <input
                    type="hidden"
                    name="teamId"
                    value={projection.teamId}
                  />
                  <input
                    type="hidden"
                    name="eventId"
                    value={projection.eventId}
                  />
                  <input
                    type="hidden"
                    name="playerId"
                    value={player.playerId}
                  />
                  <p>{player.label}</p>
                  <label>
                    Status
                    <select name="status" defaultValue="ATTENDING">
                      <option value="ATTENDING">Attending</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                      <option value="UNSURE">Unsure</option>
                    </select>
                  </label>
                  <label>
                    Absence
                    <select name="absenceCategory" defaultValue="">
                      <option value="">None</option>
                      <option value="SICK">Sick</option>
                      <option value="INJURY">Injury</option>
                      <option value="FAMILY">Family</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    Private note
                    <textarea name="privateNote" />
                  </label>
                  <button type="submit">Save RSVP</button>
                </form>
              ))}
        </>
      )}
    </section>
  );
}
