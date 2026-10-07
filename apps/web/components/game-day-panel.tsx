import type { GameDayProjection } from "@stable/game-day";

export function GameDayPanel({
  projection,
  error,
  players = [],
  recordAction,
  dutyProposal,
  createDuty,
  commitDuty,
  acknowledgeDuty,
  swaps,
  requestSwap,
  acceptSwap,
  fillRequestId,
  fillCandidates = [],
  fillResponses = [],
  ownFillPlayers = [],
  requestFillIn,
  confirmFillIn,
  respondFillIn,
}: {
  projection: GameDayProjection | null;
  error?: string | undefined;
  players?: { playerId: string; label: string }[] | undefined;
  recordAction?: ((formData: FormData) => Promise<void>) | undefined;
  dutyProposal?: { fingerprint: string; lines: string[] } | undefined;
  createDuty?: ((formData: FormData) => Promise<void>) | undefined;
  commitDuty?: ((formData: FormData) => Promise<void>) | undefined;
  acknowledgeDuty?: ((formData: FormData) => Promise<void>) | undefined;
  swaps?: { id: string; label: string }[] | undefined;
  requestSwap?: ((formData: FormData) => Promise<void>) | undefined;
  acceptSwap?: ((formData: FormData) => Promise<void>) | undefined;
  fillRequestId?: string | null | undefined;
  fillCandidates?: { playerId: string; displayName: string }[] | undefined;
  fillResponses?: { playerId: string; displayName: string }[] | undefined;
  ownFillPlayers?: { playerId: string; displayName: string }[] | undefined;
  requestFillIn?: ((formData: FormData) => Promise<void>) | undefined;
  confirmFillIn?: ((formData: FormData) => Promise<void>) | undefined;
  respondFillIn?: ((formData: FormData) => Promise<void>) | undefined;
}) {
  const openFillRequestId =
    typeof fillRequestId === "string" ? fillRequestId : null;
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
          <p>Fill-in {projection.fillInLabel ?? "None"}</p>
          {requestFillIn !== undefined && openFillRequestId === null ? (
            <form action={requestFillIn}>
              <input type="hidden" name="clubId" value={projection.clubId} />
              <input type="hidden" name="teamId" value={projection.teamId} />
              <input type="hidden" name="eventId" value={projection.eventId} />
              <button type="submit">Request fill-in</button>
            </form>
          ) : null}
          {fillCandidates.map((candidate) => (
            <p key={candidate.playerId}>Candidate {candidate.displayName}</p>
          ))}
          {confirmFillIn !== undefined && openFillRequestId !== null
            ? fillResponses.map((response) => (
                <form action={confirmFillIn} key={response.playerId}>
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
                  <input type="hidden" name="requestId" value={openFillRequestId} />
                  <input
                    type="hidden"
                    name="playerId"
                    value={response.playerId}
                  />
                  <p>Response {response.displayName}</p>
                  <button type="submit">Confirm fill-in</button>
                </form>
              ))
            : null}
          {respondFillIn !== undefined && openFillRequestId !== null
            ? ownFillPlayers.map((player) => (
                <form action={respondFillIn} key={player.playerId}>
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
                  <input type="hidden" name="requestId" value={openFillRequestId} />
                  <input
                    type="hidden"
                    name="playerId"
                    value={player.playerId}
                  />
                  <p>Your player {player.displayName}</p>
                  <button type="submit">Respond to fill-in</button>
                </form>
              ))
            : null}
          {acknowledgeDuty !== undefined && projection.ownDutyLabel !== null ? (
            <form action={acknowledgeDuty}>
              <input type="hidden" name="clubId" value={projection.clubId} />
              <input type="hidden" name="teamId" value={projection.teamId} />
              <input type="hidden" name="eventId" value={projection.eventId} />
              <button type="submit">Acknowledge duty</button>
            </form>
          ) : null}
          {requestSwap !== undefined && projection.ownDutyLabel !== null ? (
            <form action={requestSwap}>
              <input type="hidden" name="clubId" value={projection.clubId} />
              <input type="hidden" name="teamId" value={projection.teamId} />
              <input type="hidden" name="eventId" value={projection.eventId} />
              <label>
                Offer to
                <input name="targetUserId" />
              </label>
              <button type="submit">Request duty swap</button>
            </form>
          ) : null}
          {acceptSwap !== undefined && swaps !== undefined
            ? swaps.map((swap) => (
                <form action={acceptSwap} key={swap.id}>
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
                  <input type="hidden" name="requestId" value={swap.id} />
                  <p>Open swap {swap.label}</p>
                  <button type="submit">Accept swap</button>
                </form>
              ))
            : null}
          {dutyProposal === undefined
            ? null
            : dutyProposal.lines.map((line) => <p key={line}>{line}</p>)}
          {commitDuty !== undefined &&
          dutyProposal !== undefined &&
          dutyProposal.fingerprint.length > 0 ? (
            <form action={commitDuty}>
              <input type="hidden" name="clubId" value={projection.clubId} />
              <input type="hidden" name="teamId" value={projection.teamId} />
              <input type="hidden" name="eventId" value={projection.eventId} />
              <input
                type="hidden"
                name="fingerprint"
                value={dutyProposal.fingerprint}
              />
              <button type="submit">Commit allocation</button>
            </form>
          ) : null}
          {createDuty !== undefined ? (
            <form action={createDuty}>
              <input type="hidden" name="clubId" value={projection.clubId} />
              <input type="hidden" name="teamId" value={projection.teamId} />
              <input type="hidden" name="eventId" value={projection.eventId} />
              <label>
                Duty
                <select name="dutyType" defaultValue="SCORER">
                  <option value="SCORER">Scorer</option>
                  <option value="CLOCK">Clock</option>
                  <option value="CANTEEN">Canteen</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Label
                <input name="label" required />
              </label>
              <button type="submit">Add open duty</button>
            </form>
          ) : null}
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
