import type { CSSProperties } from "react";
import type { ClubStructureSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";

type ClubStructurePanelProps = {
  clubId: string | null;
  snapshot: ClubStructureSnapshot;
  action: (formData: FormData) => void | Promise<void>;
  error?: string | undefined;
};

export function ClubStructurePanel({
  clubId,
  snapshot,
  action,
  error,
}: ClubStructurePanelProps) {
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
            name: season.name,
          }))}
        />
        <NameList
          title="Teams"
          items={snapshot.teams.map((team) => ({
            id: team.id,
            name: team.name,
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
      </div>
      {clubId === null ? null : (
        <form action={action} style={{ marginTop: theme.space[6] }}>
          <input type="hidden" name="clubId" value={clubId} />
          <div
            style={{
              display: "grid",
              gap: theme.space[4],
              maxWidth: "28rem",
            }}
          >
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
              Team name
              <input
                id="team-name"
                name="teamName"
                required
                maxLength={120}
                style={inputStyle(theme)}
              />
            </label>
            <button
              type="submit"
              style={{
                minHeight: 44,
                padding: `0 ${theme.space[4]}px`,
                background: theme.color.brand.primary,
                color: theme.color.text.inverse,
                border: `1px solid ${theme.color.brand.primary}`,
                borderRadius: theme.radius.sm,
              }}
            >
              Create season and team
            </button>
          </div>
        </form>
      )}
    </section>
  );
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
