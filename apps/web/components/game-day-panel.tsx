import type { GameDayProjection } from "@stable/game-day";
import { formatScheduleDateTime } from "@stable/schedule";
import styles from "./game-day-panel.module.css";

export function GameDayPanel({
  projection,
  timezone,
  error,
  notice,
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
  timezone: string;
  error?: string | undefined;
  notice?: string | undefined;
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
    <section className={styles.gameDay} aria-label="Game day">
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {notice !== undefined ? <p role="status">{notice}</p> : null}
      {projection === null ? null : (
        <>
          <header className={styles.hero}>
            <div className={styles.heroTitle}>
              <p className={styles.kicker}>Game Day</p>
              <h1>{projection.opponentName}</h1>
              {projection.roundLabel ? (
                <p className={styles.round}>{projection.roundLabel}</p>
              ) : null}
            </div>
            <dl className={styles.facts}>
              <Fact
                label="Tip-off"
                value={formatScheduleDateTime(
                  projection.officialStartAt,
                  timezone,
                )}
              />
              <Fact
                label="Arrive"
                value={
                  projection.arrivalAt === null
                    ? "Not set"
                    : formatScheduleDateTime(projection.arrivalAt, timezone)
                }
              />
              <Fact label="Venue" value={projection.venueText ?? "Not set"} />
              <Fact label="Court" value={projection.courtLabel ?? "Not set"} />
            </dl>
            <dl
              className={styles.personalFacts}
              aria-label="Your Game Day details"
            >
              <Fact
                label="Your RSVP"
                value={projection.ownRsvp.toLowerCase().replaceAll("_", " ")}
              />
              <Fact
                label="Your duty"
                value={projection.ownDutyLabel ?? "None assigned"}
              />
              <Fact label="Fill-in" value={projection.fillInLabel ?? "None"} />
            </dl>
          </header>
          {projection.uniformNote || projection.coachFocus ? (
            <dl className={styles.prepNotes} aria-label="Game preparation">
              {projection.uniformNote ? (
                <Fact label="Uniform" value={projection.uniformNote} />
              ) : null}
              {projection.coachFocus ? (
                <Fact label="Coach note" value={projection.coachFocus} />
              ) : null}
            </dl>
          ) : null}
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
                  <input
                    type="hidden"
                    name="requestId"
                    value={openFillRequestId}
                  />
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
                  <input
                    type="hidden"
                    name="requestId"
                    value={openFillRequestId}
                  />
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
          {projection.ownDutyLabel !== null &&
          projection.ownDutyStatus === "ACKNOWLEDGED" ? (
            <p>Duty acknowledged</p>
          ) : acknowledgeDuty !== undefined &&
            projection.ownDutyLabel !== null ? (
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
            <dl className={styles.teamReadiness} aria-label="Team RSVP summary">
              <Metric label="Attending" value={projection.attendingCount} />
              <Metric
                label="Unavailable"
                value={projection.unavailableCount ?? 0}
              />
              <Metric label="Unsure" value={projection.unsureCount ?? 0} />
              <Metric
                label="Unanswered"
                value={projection.unansweredCount ?? 0}
              />
            </dl>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value.toLocaleString("en-AU")}</dd>
    </div>
  );
}
