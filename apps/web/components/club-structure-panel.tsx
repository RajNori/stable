import type { CSSProperties } from "react";
import type { ClubStructureSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";

type ClubStructurePanelProps = {
  clubId: string | null;
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
  const theme = themeFor("mustangs");
  const activeSeasons = snapshot.seasons.filter((season) => season.active);
  const cardStyle: CSSProperties = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
  };

  return (
    <section aria-label="Club structure" style={cardStyle}>
      <h2
        style={{
          margin: 0,
          fontSize: theme.typeScale.headingSm.fontSize,
          lineHeight: `${theme.typeScale.headingSm.lineHeight}px`,
          fontWeight: theme.typeScale.headingSm.fontWeight,
        }}
      >
        Club structure
      </h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      <style>{`
        .club-structure-columns {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: var(--structure-gap);
          margin-top: var(--structure-gap);
        }
        @media (max-width: 960px) {
          .club-structure-columns {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
      <div
        className="club-structure-columns"
        style={
          {
            "--structure-gap": `${theme.space[6]}px`,
          } as CSSProperties
        }
      >
        <NameList
          title="Seasons"
          items={snapshot.seasons.map((season) => ({
            id: season.id,
            name: season.active ? season.name : `${season.name} (inactive)`,
            edit:
              updateSeasonAction === undefined
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
          title="Competitions"
          items={snapshot.competitions.map((competition) => ({
            id: competition.id,
            name: competition.active
              ? competition.name
              : `${competition.name} (inactive)`,
            edit:
              updateCompetitionAction === undefined
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
          title="Teams"
          items={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.active ? team.name : `${team.name} (inactive)`,
            edit:
              updateTeamAction === undefined
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
          title="Venues"
          items={snapshot.venues.map((venue) => ({
            id: venue.id,
            name: venue.active ? venue.name : `${venue.name} (inactive)`,
            edit:
              updateVenueAction === undefined
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
      {clubId === null ? null : (
        <div
          style={{
            display: "grid",
            gap: theme.space[6],
            marginTop: theme.space[6],
          }}
        >
          <form action={action} style={formStyle(theme)}>
            <input type="hidden" name="clubId" value={clubId} />
            <label htmlFor="season-name">
              Season name
              <input
                id="season-name"
                name="seasonName"
                required
                maxLength={120}
                style={inputStyle(theme)}
              />
            </label>
            <label htmlFor="team-name">
              First team name
              <input
                id="team-name"
                name="teamName"
                required
                maxLength={120}
                style={inputStyle(theme)}
              />
            </label>
            <button type="submit" style={buttonStyle(theme)}>
              Create season and team
            </button>
          </form>
          {createCompetitionAction === undefined ? null : (
            <form action={createCompetitionAction} style={formStyle(theme)}>
              <input type="hidden" name="clubId" value={clubId} />
              <label htmlFor="competition-season">
                Season for competition
                <select
                  id="competition-season"
                  name="seasonId"
                  required
                  style={inputStyle(theme)}
                >
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
                  style={inputStyle(theme)}
                />
              </label>
              <button
                type="submit"
                disabled={activeSeasons.length === 0}
                style={buttonStyle(theme)}
              >
                Create competition
              </button>
            </form>
          )}
          {createVenueAction === undefined ? null : (
            <form action={createVenueAction} style={formStyle(theme)}>
              <input type="hidden" name="clubId" value={clubId} />
              <label htmlFor="venue-name">
                Venue name
                <input
                  id="venue-name"
                  name="name"
                  required
                  maxLength={120}
                  style={inputStyle(theme)}
                />
              </label>
              <button type="submit" style={buttonStyle(theme)}>
                Create venue
              </button>
            </form>
          )}
          {createTeamAction === undefined ? null : (
            <form action={createTeamAction} style={formStyle(theme)}>
              <input type="hidden" name="clubId" value={clubId} />
              <label htmlFor="team-season">
                Team season
                <select
                  id="team-season"
                  name="seasonId"
                  required
                  style={inputStyle(theme)}
                >
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
                  style={inputStyle(theme)}
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
                <select
                  id="team-venue"
                  name="venueId"
                  defaultValue=""
                  style={inputStyle(theme)}
                >
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
                  style={inputStyle(theme)}
                />
              </label>
              <button
                type="submit"
                disabled={activeSeasons.length === 0}
                style={buttonStyle(theme)}
              >
                Create team
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function formStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    display: "grid",
    gap: theme.space[4],
    maxWidth: "32rem",
  };
}

function buttonStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    minHeight: 44,
    padding: `0 ${theme.space[4]}px`,
    background: theme.color.brand.primary,
    color: theme.color.text.inverse,
    border: `1px solid ${theme.color.brand.primary}`,
    borderRadius: theme.radius.sm,
  };
}

function NameList({
  title,
  items,
}: {
  title: string;
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
  const theme = themeFor("mustangs");
  return (
    <div>
      <h3
        style={{
          margin: 0,
          fontSize: theme.typeScale.labelMd.fontSize,
          color: theme.color.text.secondary,
        }}
      >
        {title}
      </h3>
      <ul
        aria-label={title}
        style={{
          margin: `${theme.space[3]}px 0 0`,
          paddingLeft: theme.space[5],
        }}
      >
        {items.map((item) => (
          <li key={item.id}>
            {item.href === undefined ? (
              item.name
            ) : (
              <a href={item.href}>{item.name}</a>
            )}
            {item.links?.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            {item.edit === undefined ? null : (
              <form
                action={item.edit.action}
                style={{
                  display: "grid",
                  gap: theme.space[3],
                  maxWidth: "32rem",
                  marginTop: theme.space[3],
                }}
              >
                <input type="hidden" name="recordId" value={item.id} />
                <label htmlFor={`structure-name-${item.id}`}>
                  {item.edit.label} name
                  <input
                    id={`structure-name-${item.id}`}
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={item.edit.name}
                    style={inputStyle(theme)}
                  />
                </label>
                <label htmlFor={`structure-active-${item.id}`}>
                  Status
                  <select
                    id={`structure-active-${item.id}`}
                    name="active"
                    defaultValue={String(item.edit.active)}
                    style={inputStyle(theme)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <button type="submit" style={buttonStyle(theme)}>
                  Save {item.edit.label}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function inputStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: theme.space[2],
    minHeight: 44,
    padding: `0 ${theme.space[3]}px`,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.sm,
    background: theme.color.background.canvas,
    color: theme.color.text.primary,
  };
}
