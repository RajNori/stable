import type {
  GameDayProjection,
  TeamManagerGameDayOperations,
} from "@stable/game-day";
import type { AnnouncementRecord } from "@stable/announcements";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Dumbbell,
  MapPin,
  Trophy,
} from "lucide-react";
import { formatScheduleDateTime, type ScheduleEntry } from "@stable/schedule";

import styles from "./role-home-panel.module.css";

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
  error,
}: RoleHomePanelProps) {
  if (selectedTeam === null) {
    return (
      <section className={styles.chooseTeam} aria-labelledby="role-home-title">
        <p className={styles.roleLabel}>{role ?? "Team"} workspace</p>
        <h1 id="role-home-title">Choose a team</h1>
        <p>
          Your team context determines the schedule and actions available to
          you.
        </p>
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              <a href={`/?team=${encodeURIComponent(team.id)}`}>
                {team.name}
                <ArrowRight aria-hidden="true" size={17} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const isGuardian = role === "Guardian";
  const isCoach = role === "Head Coach" || role === "Assistant Coach";
  const isManager = role === "Team Manager";
  const formatDate = (event: ScheduleEntry) =>
    formatScheduleDateTime(event.startsAt, timezone);
  const eventHref = nextGame
    ? `/teams/${selectedTeam.id}/games/${nextGame.eventId}`
    : null;

  return (
    <section className={styles.home} aria-labelledby="role-home-title">
      <header className={styles.pageHeading}>
        <div>
          <p className={styles.roleLabel}>{role ?? "Team"} home</p>
          <h1 id="role-home-title">{selectedTeam.name}</h1>
          <p className={styles.headingDetail}>
            {isGuardian
              ? "Your family’s schedule and team updates."
              : "Your team schedule, updates and next actions."}
          </p>
        </div>
        <div className={styles.switchers}>
          {teams.length > 1 ? (
            <details className={styles.switcher}>
              <summary aria-label="Switch team">
                Switch team <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <nav aria-label="Available teams">
                {teams
                  .filter((team) => team.id !== selectedTeam.id)
                  .map((team) => (
                    <a
                      key={team.id}
                      href={`/?team=${encodeURIComponent(team.id)}`}
                    >
                      {team.name}
                    </a>
                  ))}
              </nav>
            </details>
          ) : null}
          {availableRoles.length > 1 ? (
            <details className={styles.switcher}>
              <summary aria-label="Switch role">
                View as {role ?? "team"}{" "}
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <nav aria-label="Available roles">
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
            </details>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <section
            className={styles.gameSection}
            aria-labelledby="next-game-title"
          >
            {nextGame && eventHref ? (
              <article className={styles.gameHero}>
                <div className={styles.gameIntro}>
                  <div className={styles.gameEyebrow}>
                    <Trophy size={15} aria-hidden="true" /> Next game
                  </div>
                  <h2 id="next-game-title">{nextGame.opponentName}</h2>
                  {nextGame.roundLabel ? (
                    <p className={styles.round}>{nextGame.roundLabel}</p>
                  ) : null}
                </div>
                <div className={styles.gameFacts}>
                  <div>
                    <CalendarDays size={17} aria-hidden="true" />
                    <span>{formatDate(nextGame)}</span>
                  </div>
                  {gameDay?.arrivalAt ? (
                    <div>
                      <span className={styles.factLabel}>Arrive</span>
                      <span>
                        {formatScheduleDateTime(gameDay.arrivalAt, timezone)}
                      </span>
                    </div>
                  ) : null}
                  {gameDay?.venueText ? (
                    <div>
                      <MapPin size={17} aria-hidden="true" />
                      <span>
                        {gameDay.venueText}
                        {gameDay.courtLabel ? ` · ${gameDay.courtLabel}` : ""}
                      </span>
                    </div>
                  ) : null}
                  {isGuardian && gameDay ? (
                    <div className={styles.personalStatus}>
                      <span>
                        <span className={styles.factLabel}>Your RSVP</span>
                        {gameDay.ownRsvp.toLowerCase().replaceAll("_", " ")}
                      </span>
                      {gameDay.ownDutyLabel ? (
                        <span>
                          <span className={styles.factLabel}>Your duty</span>
                          {gameDay.ownDutyLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!isGuardian && gameDay?.unansweredCount != null ? (
                    <div className={styles.readiness}>
                      <span className={styles.readinessNumber}>
                        {gameDay.unansweredCount}
                      </span>
                      <span>
                        RSVP{gameDay.unansweredCount === 1 ? "" : "s"} still
                        unanswered
                      </span>
                    </div>
                  ) : null}
                  {!isGuardian && gameDay?.ownDutyLabel ? (
                    <div className={styles.staffStatus}>
                      <span>
                        <span className={styles.factLabel}>Your duty</span>
                        {gameDay.ownDutyLabel} ·{" "}
                        {gameDay.ownDutyStatus?.toLowerCase()}
                      </span>
                      {gameDay.fillInLabel ? (
                        <span>
                          <span className={styles.factLabel}>Fill-in</span>
                          {gameDay.fillInLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!isGuardian && gameDay?.attendingCount != null ? (
                    <div
                      className={styles.rsvpSummary}
                      aria-label="Team RSVP summary"
                    >
                      <span>
                        <strong>{gameDay.attendingCount}</strong> attending
                      </span>
                      <span>
                        <strong>{gameDay.unavailableCount ?? 0}</strong>{" "}
                        unavailable
                      </span>
                      <span>
                        <strong>{gameDay.unsureCount ?? 0}</strong> unsure
                      </span>
                    </div>
                  ) : null}
                </div>
                <a className={styles.gameAction} href={eventHref}>
                  {isGuardian
                    ? "Open Game Day"
                    : "Open Game Day and team stats"}
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </article>
            ) : (
              <div className={styles.gameEmpty}>
                <div className={styles.emptyIcon}>
                  <CalendarDays size={19} aria-hidden="true" />
                </div>
                <div>
                  <h2 id="next-game-title">No upcoming game</h2>
                  <p>There’s no game scheduled for this team yet.</p>
                </div>
              </div>
            )}
          </section>

          {isManager ? (
            <section
              className={styles.managerPanel}
              aria-labelledby="manager-operations-title"
            >
              <div className={styles.sectionTitle}>
                <div>
                  <h2 id="manager-operations-title">Game Day readiness</h2>
                  <p>Team operations for the next fixture</p>
                </div>
                {eventHref ? (
                  <a href={eventHref}>
                    Open operations
                    <ArrowRight size={15} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              {managerOperationsError ? (
                <p role="status" className={styles.quietError}>
                  {managerOperationsError}
                </p>
              ) : managerOperations ? (
                <dl className={styles.managerMetrics}>
                  <ManagerMetric
                    label="Duties assigned"
                    value={managerOperations.assignedDutyCount}
                    detail={`${managerOperations.unassignedDutyCount} unassigned`}
                  />
                  <ManagerMetric
                    label="Acknowledged"
                    value={managerOperations.acknowledgedDutyCount}
                    detail={`${managerOperations.pendingDutyAcknowledgementCount} pending`}
                  />
                  <ManagerMetric
                    label="Open swaps"
                    value={managerOperations.openDutySwapCount}
                    detail="Need a response"
                  />
                  <ManagerMetric
                    label="Fill-ins"
                    value={managerOperations.confirmedFillInCount}
                    detail={`${managerOperations.openFillInRequestCount} needs · ${managerOperations.openFillInResponseCount} responses`}
                  />
                </dl>
              ) : nextGame ? (
                <p className={styles.quietError}>
                  Game Day operations status is unavailable.
                </p>
              ) : (
                <p className={styles.quietError}>
                  No upcoming game needs operational follow-up.
                </p>
              )}
            </section>
          ) : null}

          {isCoach ? (
            <section
              className={styles.coachingSection}
              aria-labelledby="coaching-actions-title"
            >
              <div className={styles.sectionTitle}>
                <div>
                  <h2 id="coaching-actions-title">Coaching</h2>
                  <p>Plan the next session and manage game-day details.</p>
                </div>
              </div>
              <div className={styles.actionLinks}>
                {eventHref ? (
                  <a href={eventHref}>
                    <span className={styles.actionIcon}>
                      <Trophy size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>Game Day</strong>
                      <small>Team readiness, player stats and review</small>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                ) : null}
                <a href={`/teams/${selectedTeam.id}/training`}>
                  <span className={styles.actionIcon}>
                    <Dumbbell size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Training and plans</strong>
                    <small>Schedule training and prepare practice</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </div>
            </section>
          ) : null}
        </div>

        <aside
          className={styles.secondaryColumn}
          aria-label="Team updates and schedule"
        >
          {nextTraining ? (
            <section
              className={styles.sideSection}
              aria-labelledby="next-training-title"
            >
              <div className={styles.sideHeading}>
                <Dumbbell size={17} aria-hidden="true" />
                <h2 id="next-training-title">Next training</h2>
              </div>
              <p className={styles.sideDate}>{formatDate(nextTraining)}</p>
              <a
                className={styles.textAction}
                href={`/teams/${selectedTeam.id}/training`}
              >
                Open training
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </section>
          ) : (
            <section
              className={styles.sideSection}
              aria-labelledby="next-training-title"
            >
              <div className={styles.sideHeading}>
                <Dumbbell size={17} aria-hidden="true" />
                <h2 id="next-training-title">Next training</h2>
              </div>
              <p className={styles.muted}>No upcoming training is scheduled.</p>
            </section>
          )}

          {latestAnnouncement ? (
            <section
              className={styles.updateSection}
              aria-labelledby="latest-update-title"
            >
              <div className={styles.sectionTitle}>
                <div>
                  <h2 id="latest-update-title">Latest update</h2>
                  <p>From your team</p>
                </div>
              </div>
              <article className={styles.updateBody}>
                <h3>{latestAnnouncement.title}</h3>
                <p>{latestAnnouncement.body}</p>
                {latestAnnouncement.acknowledgementRequired &&
                latestAnnouncement.acknowledgedAt === null ? (
                  <span className={styles.responseRequired}>
                    Response requested
                  </span>
                ) : null}
                <a
                  className={styles.textAction}
                  href={`/teams/${selectedTeam.id}/announcements`}
                >
                  Open team updates
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              </article>
            </section>
          ) : null}

          <nav className={styles.teamNav} aria-label="Team workspace">
            <h2>Team workspace</h2>
            <div className={styles.teamNavLinks}>
              <a href={`/teams/${selectedTeam.id}/schedule`}>
                Schedule
                <ArrowRight size={15} aria-hidden="true" />
              </a>
              <a href={`/teams/${selectedTeam.id}/fixtures`}>
                Fixtures
                <ArrowRight size={15} aria-hidden="true" />
              </a>
              <a href={`/teams/${selectedTeam.id}/roster`}>
                {isGuardian ? "Team roster" : "Roster"}
                <ArrowRight size={15} aria-hidden="true" />
              </a>
              <a href={`/teams/${selectedTeam.id}/announcements`}>
                {isGuardian ? "Team updates" : "Announcements"}
                <ArrowRight size={15} aria-hidden="true" />
              </a>
              {!isCoach && !isGuardian ? (
                <a href={`/teams/${selectedTeam.id}/training`}>
                  Training
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </nav>
        </aside>
      </div>
    </section>
  );
}

function ManagerMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className={styles.managerMetric}>
      <dt>{label}</dt>
      <dd>{value.toLocaleString("en-AU")}</dd>
      <span>{detail}</span>
    </div>
  );
}
