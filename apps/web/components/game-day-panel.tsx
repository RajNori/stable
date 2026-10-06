import type { GameDayProjection } from "@stable/game-day";

export function GameDayPanel({
  projection,
  error,
}: {
  projection: GameDayProjection | null;
  error?: string | undefined;
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
        </>
      )}
    </section>
  );
}
