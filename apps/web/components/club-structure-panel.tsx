import type { ClubStructureSnapshot } from "@stable/contracts";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  MapPin,
  Trophy,
} from "lucide-react";
import styles from "./club-structure-panel.module.css";

type ClubStructurePanelProps = {
  clubId: string | null;
  canManage: boolean;
  snapshot: ClubStructureSnapshot;
  action: (formData: FormData) => void | Promise<void>;
  createCompetitionAction?:
    ((formData: FormData) => void | Promise<void>) | undefined;
  createTeamAction?: ((formData: FormData) => void | Promise<void>) | undefined;
  createVenueAction?:
    ((formData: FormData) => void | Promise<void>) | undefined;
  updateSeasonAction?:
    ((formData: FormData) => void | Promise<void>) | undefined;
  updateCompetitionAction?:
    ((formData: FormData) => void | Promise<void>) | undefined;
  updateTeamAction?: ((formData: FormData) => void | Promise<void>) | undefined;
  updateVenueAction?:
    ((formData: FormData) => void | Promise<void>) | undefined;
  error?: string | undefined;
};

export function ClubStructurePanel({
  clubId,
  canManage,
  snapshot,
  action,
  createCompetitionAction,
  createTeamAction,
  createVenueAction,
  updateSeasonAction,
  updateCompetitionAction,
  updateTeamAction,
  updateVenueAction,
  error,
}: ClubStructurePanelProps) {
  const activeSeasons = snapshot.seasons.filter((season) => season.active);

  return (
    <section className={styles.panel} aria-label="Club structure">
      <header className={styles.pageHeader}>
        <div className={styles.pageMark} aria-hidden="true">
          <Building2 size={19} />
        </div>
        <div>
          <p className={styles.kicker}>Club operations</p>
          <h1>Club structure</h1>
          <p className={styles.pageIntro}>
            Keep seasons, competitions, teams and venues in step.
          </p>
        </div>
      </header>
      {error !== undefined ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.columns}>
        <NameList
          icon="season"
          title="Seasons"
          items={snapshot.seasons.map((season) => ({
            id: season.id,
            name: season.active ? season.name : `${season.name} (inactive)`,
            edit:
              !canManage || updateSeasonAction === undefined
                ? undefined
                : {
                    action: updateSeasonAction,
                    name: season.name,
                    active: season.active,
                    label: "season",
                  },
          }))}
        />
        <NameList
          icon="competition"
          title="Competitions"
          items={snapshot.competitions.map((competition) => ({
            id: competition.id,
            name: competition.active
              ? competition.name
              : `${competition.name} (inactive)`,
            edit:
              !canManage || updateCompetitionAction === undefined
                ? undefined
                : {
                    action: updateCompetitionAction,
                    name: competition.name,
                    active: competition.active,
                    label: "competition",
                  },
          }))}
        />
        <NameList
          icon="team"
          title="Teams"
          items={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.active ? team.name : `${team.name} (inactive)`,
            edit:
              !canManage || updateTeamAction === undefined
                ? undefined
                : {
                    action: updateTeamAction,
                    name: team.name,
                    active: team.active,
                    label: "team",
                  },
            href: `/teams/${team.id}/staff`,
            links: [
              { href: `/teams/${team.id}/roster`, label: "Roster" },
              { href: `/teams/${team.id}/fixtures`, label: "Fixtures" },
              { href: `/teams/${team.id}/schedule`, label: "Schedule" },
              { href: `/teams/${team.id}/training`, label: "Training" },
              {
                href: `/teams/${team.id}/announcements`,
                label: "Announcements",
              },
            ],
          }))}
        />
        <NameList
          icon="venue"
          title="Venues"
          items={snapshot.venues.map((venue) => ({
            id: venue.id,
            name: venue.active ? venue.name : `${venue.name} (inactive)`,
            edit:
              !canManage || updateVenueAction === undefined
                ? undefined
                : {
                    action: updateVenueAction,
                    name: venue.name,
                    active: venue.active,
                    label: "venue",
                  },
          }))}
        />
      </div>
      {clubId === null || !canManage ? null : (
        <section
          className={styles.createSection}
          aria-labelledby="create-structure-title"
        >
          <div className={styles.createHeading}>
            <div>
              <p className={styles.kicker}>Build your club</p>
              <h2 id="create-structure-title">Add to your structure</h2>
            </div>
            <p>
              New records are available to authorized team members as soon as
              they’re saved.
            </p>
          </div>
          <div className={styles.createGrid}>
            <form action={action} className={styles.createCard}>
              <h3>
                <CalendarDays size={17} aria-hidden="true" />
                Season and first team
              </h3>
              <input type="hidden" name="clubId" value={clubId} />
              <label htmlFor="season-name">
                Season name
                <input
                  id="season-name"
                  name="seasonName"
                  required
                  maxLength={120}
                />
              </label>
              <label htmlFor="team-name">
                First team name
                <input
                  id="team-name"
                  name="teamName"
                  required
                  maxLength={120}
                />
              </label>
              <button
                type="submit"
                className="stable-button stable-button--primary"
              >
                Create season and team
              </button>
            </form>
            {createCompetitionAction === undefined ? null : (
              <form
                action={createCompetitionAction}
                className={styles.createCard}
              >
                <h3>
                  <Trophy size={17} aria-hidden="true" />
                  Competition
                </h3>
                <input type="hidden" name="clubId" value={clubId} />
                <label htmlFor="competition-season">
                  Season for competition
                  <select id="competition-season" name="seasonId" required>
                    {activeSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="competition-name">
                  Competition name
                  <input
                    id="competition-name"
                    name="name"
                    required
                    maxLength={120}
                  />
                </label>
                <button type="submit" disabled={activeSeasons.length === 0}>
                  Create competition
                </button>
              </form>
            )}
            {createVenueAction === undefined ? null : (
              <form action={createVenueAction} className={styles.createCard}>
                <h3>
                  <MapPin size={17} aria-hidden="true" />
                  Venue
                </h3>
                <input type="hidden" name="clubId" value={clubId} />
                <label htmlFor="venue-name">
                  Venue name
                  <input id="venue-name" name="name" required maxLength={120} />
                </label>
                <button
                  type="submit"
                  className="stable-button stable-button--secondary"
                >
                  Create venue
                </button>
              </form>
            )}
            {createTeamAction === undefined ? null : (
              <form action={createTeamAction} className={styles.createCard}>
                <h3>
                  <Building2 size={17} aria-hidden="true" />
                  Team
                </h3>
                <input type="hidden" name="clubId" value={clubId} />
                <label htmlFor="team-season">
                  Team season
                  <select id="team-season" name="seasonId" required>
                    {activeSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="team-competition">
                  Competition (optional)
                  <select
                    id="team-competition"
                    name="competitionId"
                    defaultValue=""
                  >
                    <option value="">No competition</option>
                    {snapshot.competitions
                      .filter((item) => item.active)
                      .map((competition) => (
                        <option key={competition.id} value={competition.id}>
                          {competition.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label htmlFor="team-venue">
                  Home venue (optional)
                  <select id="team-venue" name="venueId" defaultValue="">
                    <option value="">No venue</option>
                    {snapshot.venues
                      .filter((venue) => venue.active)
                      .map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label htmlFor="new-team-name">
                  Team name
                  <input
                    id="new-team-name"
                    name="name"
                    required
                    maxLength={120}
                  />
                </label>
                <button type="submit" disabled={activeSeasons.length === 0}>
                  Create team
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function NameList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: "season" | "competition" | "team" | "venue";
  items: readonly {
    id: string;
    name: string;
    href?: string;
    links?: readonly { href: string; label: string }[];
    edit?:
      | {
          action: (formData: FormData) => void | Promise<void>;
          name: string;
          active: boolean;
          label: string;
        }
      | undefined;
  }[];
}) {
  const Icon = {
    season: CalendarDays,
    competition: Trophy,
    team: Building2,
    venue: MapPin,
  }[icon];
  return (
    <section
      className={styles.listSection}
      aria-labelledby={`club-structure-${icon}`}
    >
      <div className={styles.listHeading}>
        <span className={styles.listIcon} aria-hidden="true">
          <Icon size={17} />
        </span>
        <h2 id={`club-structure-${icon}`}>{title}</h2>
        <span className={styles.listCount}>{items.length}</span>
      </div>
      <ul aria-label={title} className={styles.recordList}>
        {items.map((item) => (
          <li key={item.id} className={styles.record}>
            <div className={styles.recordHeading}>
              {item.href === undefined ? (
                <strong>{item.name}</strong>
              ) : (
                <a href={item.href}>
                  {item.name}
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
              )}
              {item.name.includes("(inactive)") ? (
                <span className={styles.inactive}>Inactive</span>
              ) : (
                <span className={styles.active}>Active</span>
              )}
            </div>
            {item.links?.length ? (
              <nav
                aria-label={`${item.name} workspace`}
                className={styles.recordLinks}
              >
                {item.links.map((link) => (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </nav>
            ) : null}
            {item.edit === undefined ? null : (
              <form action={item.edit.action} className={styles.editForm}>
                <input type="hidden" name="recordId" value={item.id} />
                <label htmlFor={`structure-name-${item.id}`}>
                  {item.edit.label} name
                  <input
                    id={`structure-name-${item.id}`}
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={item.edit.name}
                  />
                </label>
                <label htmlFor={`structure-active-${item.id}`}>
                  Status
                  <select
                    id={`structure-active-${item.id}`}
                    name="active"
                    defaultValue={String(item.edit.active)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="stable-button stable-button--secondary"
                >
                  Save {item.edit.label}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
