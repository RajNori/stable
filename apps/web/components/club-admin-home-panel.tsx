import { themeFor } from "@stable/design-tokens";

export type ClubAdminHomeSummary = {
  activeTeamCount: number;
  activeSeasonCount: number;
  teamsNeedingLeadership: {
    id: string;
    name: string;
    missingRoles: readonly ("Head Coach" | "Team Manager")[];
  }[];
};

type ClubAdminHomePanelProps = {
  summary: ClubAdminHomeSummary | null;
  themeKey: string;
  error?: string;
};

export function ClubAdminHomePanel({
  summary,
  themeKey,
  error,
}: ClubAdminHomePanelProps) {
  const theme = themeFor(themeKey);
  const card: React.CSSProperties = {
    background: theme.color.background.surface,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    padding: theme.space[6],
    color: theme.color.text.primary,
  };

  return (
    <section
      aria-labelledby="club-admin-home-title"
      style={{ display: "grid", gap: theme.space[4] }}
    >
      <header style={card}>
        <h1 id="club-admin-home-title">Club overview</h1>
        {error ? <p role="alert">{error}</p> : null}
        {summary ? (
          <dl>
            <div>
              <dt>Active teams</dt>
              <dd>{summary.activeTeamCount}</dd>
            </div>
            <div>
              <dt>Active seasons</dt>
              <dd>{summary.activeSeasonCount}</dd>
            </div>
          </dl>
        ) : null}
        <a href="/club-structure">Review club structure</a>
      </header>

      <article style={card}>
        <h2>Needs attention</h2>
        {summary === null ? (
          <p>Club setup status could not be loaded.</p>
        ) : summary.activeTeamCount === 0 ? (
          <p>No active teams yet. Start in club structure.</p>
        ) : summary.teamsNeedingLeadership.length > 0 ? (
          <ul>
            {summary.teamsNeedingLeadership.map((team) => (
              <li key={team.id}>
                <strong>{team.name}</strong> needs{" "}
                {team.missingRoles.join(" and ")}.{" "}
                <a href={`/teams/${team.id}/staff`}>Review team staff</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Every active team has a Head Coach and Team Manager.</p>
        )}
      </article>
    </section>
  );
}
