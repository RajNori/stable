import type { GameDayProjection } from "@stable/game-day";
import type { TeamManagerGameDayOperations } from "@stable/game-day";
import type { AnnouncementRecord } from "@stable/announcements";
import { themeFor } from "@stable/design-tokens";
import { formatScheduleDateTime, type ScheduleEntry } from "@stable/schedule";

export type RoleHomeTeam = { id: string; name: string };
export type RoleHomeRole =
  "Head Coach" | "Assistant Coach" | "Team Manager" | "Guardian";

function roleView(role: RoleHomeRole): string {
  switch (role) {
    case "Head Coach":
      return "head-coach";
    case "Assistant Coach":
      return "assistant-coach";
    case "Team Manager":
      return "team-manager";
    case "Guardian":
      return "guardian";
  }
}

type RoleHomePanelProps = {
  role: RoleHomeRole | null;
  availableRoles: readonly RoleHomeRole[];
  teams: readonly RoleHomeTeam[];
  selectedTeam: RoleHomeTeam | null;
  nextGame: ScheduleEntry | null;
  nextTraining: ScheduleEntry | null;
  gameDay: GameDayProjection | null;
  managerOperations?: TeamManagerGameDayOperations | null;
  managerOperationsError?: string;
  latestAnnouncement: AnnouncementRecord | null;
  timezone: string;
  themeKey: string;
  error?: string;
};

export function RoleHomePanel({
  role,
  availableRoles,
  teams,
  selectedTeam,
  nextGame,
  nextTraining,
  gameDay,
  managerOperations = null,
  managerOperationsError,
  latestAnnouncement,
  timezone,
  themeKey,
  error,
}: RoleHomePanelProps) {
  const theme = themeFor(themeKey);
  const card: React.CSSProperties = {
    background: theme.color.background.surface,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    padding: theme.space[6],
    color: theme.color.text.primary,
  };

  if (selectedTeam === null) {
    return (
      <section aria-labelledby="role-home-title" style={card}>
        <h1 id="role-home-title">Choose your team</h1>
        <p>Your team context controls which schedule and actions are shown.</p>
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              <a href={`/?team=${encodeURIComponent(team.id)}`}>{team.name}</a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const isGuardian = role === "Guardian";
  const isCoach = role === "Head Coach" || role === "Assistant Coach";
  const formatDate = (event: ScheduleEntry) =>
    formatScheduleDateTime(event.startsAt, timezone);

  return (
    <section
      aria-labelledby="role-home-title"
      style={{ display: "grid", gap: theme.space[4] }}
    >
      <header style={card}>
        <p style={{ marginTop: 0 }}>{role ?? "Team"} home</p>
        <h1 id="role-home-title">{selectedTeam.name}</h1>
        {availableRoles.length > 1 ? (
          <nav aria-label="Switch role">
            <span>View as: </span>
            {availableRoles
              .filter((availableRole) => availableRole !== role)
              .map((availableRole) => (
                <a
                  key={availableRole}
                  href={`/?team=${encodeURIComponent(selectedTeam.id)}&view=${roleView(availableRole)}`}
                >
                  {availableRole}
                </a>
              ))}
          </nav>
        ) : null}
        {teams.length > 1 ? (
          <nav aria-label="Switch team">
            <span>Switch team: </span>
            {teams
              .filter((team) => team.id !== selectedTeam.id)
              .map((team) => (
                <a key={team.id} href={`/?team=${encodeURIComponent(team.id)}`}>
                  {team.name}
                </a>
              ))}
          </nav>
        ) : null}
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <article style={card}>
        <h2>Next game</h2>
        {nextGame ? (
          <>
            <p>
              {nextGame.opponentName}
              {nextGame.roundLabel ? ` · ${nextGame.roundLabel}` : ""}
            </p>
            <p>{formatDate(nextGame)}</p>
            {gameDay?.arrivalAt ? (
              <p>
                Arrive {formatScheduleDateTime(gameDay.arrivalAt, timezone)}
                {gameDay.venueText ? ` · ${gameDay.venueText}` : ""}
                {gameDay.courtLabel ? ` · ${gameDay.courtLabel}` : ""}
              </p>
            ) : null}
            {isGuardian && gameDay ? (
              <p>
                RSVP: {gameDay.ownRsvp.toLowerCase().replaceAll("_", " ")}
                {gameDay.ownDutyLabel
                  ? ` · Your duty: ${gameDay.ownDutyLabel}`
                  : ""}
              </p>
            ) : null}
            {!isGuardian &&
            gameDay?.unansweredCount !== null &&
            gameDay?.unansweredCount !== undefined ? (
              <p>{gameDay.unansweredCount} unanswered RSVP(s)</p>
            ) : null}
            {!isGuardian &&
            gameDay !== null &&
            gameDay.attendingCount !== null ? (
              <ul aria-label="Team RSVP summary">
                <li>Attending: {gameDay.attendingCount}</li>
                <li>Unavailable: {gameDay.unavailableCount ?? 0}</li>
                <li>Unsure: {gameDay.unsureCount ?? 0}</li>
              </ul>
            ) : null}
            {!isGuardian && gameDay?.ownDutyLabel ? (
              <p>
                Your duty: {gameDay.ownDutyLabel} ({gameDay.ownDutyStatus})
              </p>
            ) : null}
            {!isGuardian && gameDay?.fillInLabel ? (
              <p>Confirmed fill-in: {gameDay.fillInLabel}</p>
            ) : null}
            <a href={`/teams/${selectedTeam.id}/games/${nextGame.eventId}`}>
              {isGuardian
                ? "Open Game Day for RSVP and duty actions"
                : "Open event and Game Day"}
            </a>
          </>
        ) : (
          <p>No upcoming game is scheduled.</p>
        )}
      </article>

      {role === "Team Manager" ? (
        <article aria-label="Game Day operations" style={card}>
          <h2>Game Day operations</h2>
          {managerOperationsError ? (
            <p role="status">{managerOperationsError}</p>
          ) : managerOperations ? (
            <ul>
              <li>
                Duties: {managerOperations.assignedDutyCount} assigned,{" "}
                {managerOperations.unassignedDutyCount} unassigned
              </li>
              <li>
                Duty acknowledgements: {managerOperations.acknowledgedDutyCount}{" "}
                of {managerOperations.assignedDutyCount} complete;{" "}
                {managerOperations.pendingDutyAcknowledgementCount} pending
              </li>
              <li>Open duty swaps: {managerOperations.openDutySwapCount}</li>
              <li>
                Fill-in needs: {managerOperations.openFillInRequestCount} open;{" "}
                {managerOperations.openFillInResponseCount} responses;{" "}
                {managerOperations.confirmedFillInCount} confirmed
              </li>
            </ul>
          ) : nextGame ? (
            <p>Game Day operations status is unavailable.</p>
          ) : (
            <p>No upcoming game needs operational follow-up.</p>
          )}
        </article>
      ) : null}

      {latestAnnouncement ? (
        <article style={card}>
          <h2>Latest update</h2>
          <h3>{latestAnnouncement.title}</h3>
          <p>{latestAnnouncement.body}</p>
          {latestAnnouncement.acknowledgementRequired &&
          latestAnnouncement.acknowledgedAt === null ? (
            <p>Response requested</p>
          ) : null}
          <a href={`/teams/${selectedTeam.id}/announcements`}>
            Open team updates
          </a>
        </article>
      ) : null}

      {isCoach ? (
        <nav aria-label="Coaching tools" style={card}>
          <h2>Coaching tools</h2>
          <ul>
            <li>
              <a href={`/teams/${selectedTeam.id}/training`}>
                Training and practice plans
              </a>
            </li>
            {nextGame ? (
              <li>
                <a href={`/teams/${selectedTeam.id}/games/${nextGame.eventId}`}>
                  Game Day, stats and review
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}

      <article style={card}>
        <h2>Next training</h2>
        {nextTraining ? (
          <>
            <p>{formatDate(nextTraining)}</p>
            <a href={`/teams/${selectedTeam.id}/training`}>Open training</a>
          </>
        ) : (
          <p>No upcoming training is scheduled.</p>
        )}
      </article>

      <nav aria-label="Team actions" style={card}>
        <h2>Team actions</h2>
        <ul>
          <li>
            <a href={`/teams/${selectedTeam.id}/schedule`}>Schedule</a>
          </li>
          <li>
            <a href={`/teams/${selectedTeam.id}/training`}>Training</a>
          </li>
          {isGuardian ? (
            <>
              <li>
                <a href={`/teams/${selectedTeam.id}/roster`}>Team roster</a>
              </li>
              <li>
                <a href={`/teams/${selectedTeam.id}/announcements`}>
                  Team updates
                </a>
              </li>
            </>
          ) : (
            <>
              <li>
                <a href={`/teams/${selectedTeam.id}/roster`}>Roster</a>
              </li>
              <li>
                <a href={`/teams/${selectedTeam.id}/fixtures`}>Fixtures</a>
              </li>
              <li>
                <a href={`/teams/${selectedTeam.id}/announcements`}>
                  Announcements
                </a>
              </li>
            </>
          )}
        </ul>
      </nav>
    </section>
  );
}
