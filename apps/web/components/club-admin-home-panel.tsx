import { themeFor } from "@stable/design-tokens";
import type { ClubAdminInvitationSummary } from "../lib/club-admin-invitation-summary";

export type ClubAdminHomeSummary = {
  activeTeamCount: number;
  activeSeasonCount: number;
  teamsNeedingLeadership: {
    id: string;
    name: string;
    missingRoles: readonly ("Head Coach" | "Team Manager")[];
  }[];
  invitations: ClubAdminInvitationSummary | null;
  playersMissingGuardianCount: number | null;
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
        ) : (
          <ul>
            {summary.activeTeamCount === 0 ? (
              <li>
                No active teams yet.{" "}
                <a href="/club-structure">Start in club structure</a>.
              </li>
            ) : null}
            {summary.activeSeasonCount === 0 ? (
              <li>
                No active season.{" "}
                <a href="/club-structure">Set up an active season</a>.
              </li>
            ) : null}
            {summary.teamsNeedingLeadership.map((team) => (
              <li key={team.id}>
                <strong>{team.name}</strong> needs{" "}
                {team.missingRoles.join(" and ")}.{" "}
                <a href={`/teams/${team.id}/staff`}>Review team staff</a>
              </li>
            ))}
            {summary.invitations === null ? (
              <li role="status">Invitation status could not be loaded.</li>
            ) : summary.invitations.pendingCount > 0 ? (
              <li>
                {summary.invitations.pendingCount} pending staff or guardian{" "}
                invitation{summary.invitations.pendingCount === 1 ? "" : "s"}.{" "}
                {summary.invitations.expiringWithinSevenDaysCount > 0 ? (
                  <>
                    {summary.invitations.expiringWithinSevenDaysCount} expire
                    within seven days.{" "}
                  </>
                ) : null}
                <a href="/players">Review invitations</a>
              </li>
            ) : null}
            {summary.playersMissingGuardianCount === null ? (
              <li role="status">
                Player guardian coverage could not be loaded.
              </li>
            ) : summary.playersMissingGuardianCount > 0 ? (
              <li>
                {summary.playersMissingGuardianCount} active player
                {summary.playersMissingGuardianCount === 1 ? "" : "s"} need
                {summary.playersMissingGuardianCount === 1 ? "s" : ""} an active
                guardian. <a href="/players">Review player relationships</a>
              </li>
            ) : null}
            {summary.activeTeamCount > 0 &&
            summary.activeSeasonCount > 0 &&
            summary.teamsNeedingLeadership.length === 0 &&
            summary.invitations?.pendingCount === 0 &&
            summary.playersMissingGuardianCount === 0 ? (
              <li>
                No outstanding setup, leadership, invitation, or guardian-link
                issues found.
              </li>
            ) : null}
          </ul>
        )}
      </article>
    </section>
  );
}
