import type { CSSProperties } from "react";
import type { FixtureRecord } from "@stable/fixtures";
import { themeFor } from "@stable/design-tokens";

type FixturesPanelProps = {
  clubId: string;
  teamId: string;
  teamName: string;
  fixtures: readonly FixtureSummary[];
  canManageOfficial: boolean;
  canManageOverlay: boolean;
  createAction: (formData: FormData) => void | Promise<void>;
  officialAction: (formData: FormData) => void | Promise<void>;
  overlayAction: (formData: FormData) => void | Promise<void>;
  error?: string | undefined;
};

export type FixtureSummary = {
  eventId: string;
  opponentName: string;
  roundLabel: string | null;
  officialStartLocal: string;
  arrivalLocal: string;
  uniformNote: string | null;
  coachFocus: string | null;
  teamNote: string | null;
  fixtureStatus: FixtureRecord["fixtureStatus"];
};

export function FixturesPanel({
  clubId,
  teamId,
  teamName,
  fixtures,
  canManageOfficial,
  canManageOverlay,
  createAction,
  officialAction,
  overlayAction,
  error,
}: FixturesPanelProps) {
  const theme = themeFor("mustangs");
  const cardStyle: CSSProperties = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
  };

  return (
    <section aria-label="Fixtures" style={cardStyle}>
      <h2 style={{ margin: 0 }}>Fixtures for {teamName}</h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {fixtures.length === 0 ? <p>No fixtures yet.</p> : null}
      <ul aria-label="Fixture list" style={{ paddingLeft: theme.space[5] }}>
        {fixtures.map((fixture) => (
          <li key={fixture.eventId}>
            <p>
              {fixture.roundLabel === null ? "Game" : fixture.roundLabel}
              {": "}
              {fixture.opponentName} at {fixture.officialStartLocal} (
              {fixture.fixtureStatus}){" "}
              <a href={`/teams/${teamId}/games/${fixture.eventId}`}>Game day</a>
            </p>
            {canManageOfficial ? (
              <form action={officialAction}>
                <HiddenIds clubId={clubId} teamId={teamId} />
                <input type="hidden" name="eventId" value={fixture.eventId} />
                <label>
                  Opponent
                  <input
                    name="opponentName"
                    aria-label={`Opponent for ${fixture.opponentName}`}
                    defaultValue={fixture.opponentName}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Round
                  <input
                    name="roundLabel"
                    aria-label={`Round for ${fixture.opponentName}`}
                    defaultValue={fixture.roundLabel ?? ""}
                    maxLength={40}
                  />
                </label>
                <label>
                  Official start
                  <input
                    name="officialStart"
                    aria-label={`Official start for ${fixture.opponentName}`}
                    type="datetime-local"
                    required
                    defaultValue={fixture.officialStartLocal}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="fixtureStatus"
                    aria-label={`Status for ${fixture.opponentName}`}
                    defaultValue={fixture.fixtureStatus}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="POSTPONED">Postponed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </label>
                <button type="submit">Save official fixture</button>
              </form>
            ) : null}
            {canManageOverlay ? (
              <form action={overlayAction}>
                <HiddenIds clubId={clubId} teamId={teamId} />
                <input type="hidden" name="eventId" value={fixture.eventId} />
                <label>
                  Arrival
                  <input
                    name="arrivalAt"
                    aria-label={`Arrival for ${fixture.opponentName}`}
                    type="datetime-local"
                    defaultValue={fixture.arrivalLocal}
                  />
                </label>
                <label>
                  Uniform
                  <input
                    name="uniformNote"
                    aria-label={`Uniform for ${fixture.opponentName}`}
                    defaultValue={fixture.uniformNote ?? ""}
                    maxLength={500}
                  />
                </label>
                <label>
                  Coach focus
                  <input
                    name="coachFocus"
                    aria-label={`Coach focus for ${fixture.opponentName}`}
                    defaultValue={fixture.coachFocus ?? ""}
                    maxLength={500}
                  />
                </label>
                <label>
                  Team note
                  <input
                    name="teamNote"
                    aria-label={`Team note for ${fixture.opponentName}`}
                    defaultValue={fixture.teamNote ?? ""}
                    maxLength={500}
                  />
                </label>
                <button type="submit">Save team overlay</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canManageOfficial ? (
        <form action={createAction}>
          <HiddenIds clubId={clubId} teamId={teamId} />
          <label htmlFor="fixture-opponent">
            Opponent
            <input
              id="fixture-opponent"
              name="opponentName"
              required
              maxLength={120}
            />
          </label>
          <label htmlFor="fixture-round">
            Round
            <input id="fixture-round" name="roundLabel" maxLength={40} />
          </label>
          <label htmlFor="fixture-start">
            Official start
            <input
              id="fixture-start"
              name="officialStart"
              type="datetime-local"
              required
            />
          </label>
          <label htmlFor="fixture-end">
            Ends
            <input id="fixture-end" name="endsAt" type="datetime-local" />
          </label>
          <label htmlFor="fixture-venue">
            Official venue
            <input
              id="fixture-venue"
              name="officialVenueText"
              maxLength={200}
            />
          </label>
          <label htmlFor="fixture-court">
            Court
            <input id="fixture-court" name="courtLabel" maxLength={80} />
          </label>
          <label htmlFor="fixture-home">
            Home or away
            <select id="fixture-home" name="homeAway" defaultValue="">
              <option value="">Unspecified</option>
              <option value="HOME">Home</option>
              <option value="AWAY">Away</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </label>
          <label htmlFor="fixture-external">
            Import id
            <input id="fixture-external" name="externalId" maxLength={120} />
          </label>
          <button type="submit">Add fixture</button>
        </form>
      ) : null}
    </section>
  );
}

function HiddenIds({ clubId, teamId }: { clubId: string; teamId: string }) {
  return (
    <>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="teamId" value={teamId} />
    </>
  );
}
