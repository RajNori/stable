import type { ClubAdminInvitationSummary } from "../lib/club-admin-invitation-summary";
import styles from "./club-admin-home-panel.module.css";

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
  error,
}: ClubAdminHomePanelProps) {
  const attention: {
    key: string;
    text: string;
    href: string;
    action: string;
  }[] = [];
  const unavailable: string[] = [];

  if (summary !== null) {
    if (summary.activeTeamCount === 0) {
      attention.push({
        key: "teams",
        text: "Your club has no active teams yet.",
        href: "/club-structure",
        action: "Set up a team",
      });
    }
    if (summary.activeSeasonCount === 0) {
      attention.push({
        key: "season",
        text: "There isn’t an active season.",
        href: "/club-structure",
        action: "Set up a season",
      });
    }
    for (const team of summary.teamsNeedingLeadership) {
      attention.push({
        key: team.id,
        text: `${team.name} needs a ${team.missingRoles.join(" and ")}.`,
        href: `/teams/${team.id}/staff`,
        action: "Review staff",
      });
    }
    if (summary.invitations?.pendingCount) {
      const expiry = summary.invitations.expiringWithinSevenDaysCount;
      attention.push({
        key: "invitations",
        text: `${summary.invitations.pendingCount} invitation${summary.invitations.pendingCount === 1 ? " is" : "s are"} waiting${expiry > 0 ? ` · ${expiry} expire within seven days` : ""}.`,
        href: "/players",
        action: "Review invitations",
      });
    } else if (summary.invitations === null) {
      unavailable.push("Invitation status could not be loaded.");
    }
    if (
      summary.playersMissingGuardianCount !== null &&
      summary.playersMissingGuardianCount > 0
    ) {
      attention.push({
        key: "guardians",
        text: `${summary.playersMissingGuardianCount} active player${summary.playersMissingGuardianCount === 1 ? " needs" : "s need"} an active guardian link.`,
        href: "/players",
        action: "Review player links",
      });
    } else if (summary.playersMissingGuardianCount === null) {
      unavailable.push("Guardian-link coverage could not be loaded.");
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="club-admin-home-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Club operations</p>
          <h1 id="club-admin-home-title">Overview</h1>
          <p className={styles.summaryText}>
            A clear view of your club’s setup and what needs attention.
          </p>
        </div>
        <a
          className="stable-button stable-button--secondary"
          href="/club-structure"
        >
          <span>Manage club structure</span>
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <dl className={styles.metrics} aria-label="Club overview metrics">
          <Metric
            label="Active teams"
            value={summary.activeTeamCount}
            detail="In your club"
          />
          <Metric
            label="Active seasons"
            value={summary.activeSeasonCount}
            detail="Currently running"
          />
          <Metric
            label="Pending invitations"
            value={summary.invitations?.pendingCount ?? null}
            detail={
              summary.invitations === null
                ? "Status unavailable"
                : "Staff and guardians"
            }
          />
          <Metric
            label="Guardian links needed"
            value={summary.playersMissingGuardianCount}
            detail={
              summary.playersMissingGuardianCount === null
                ? "Status unavailable"
                : "Active players"
            }
          />
        </dl>
      ) : null}

      <section
        className={styles.attention}
        aria-labelledby="club-attention-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="club-attention-title">Needs attention</h2>
            <p>Follow up on the items that keep teams ready.</p>
          </div>
          {attention.length > 0 ? (
            <span
              className={styles.attentionCount}
              aria-label={`${attention.length} items need attention`}
            >
              {attention.length}
            </span>
          ) : null}
        </div>
        {summary === null ? (
          <div className={styles.empty} role="status">
            <strong>Club setup status is unavailable.</strong>
            <span>Try again in a moment.</span>
          </div>
        ) : attention.length === 0 && unavailable.length === 0 ? (
          <div className={styles.healthy} role="status">
            <span className={styles.healthyMark} aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>You’re in good shape.</strong> No setup or staffing issues
              need action right now.
            </span>
          </div>
        ) : (
          <ul className={styles.attentionList}>
            {attention.map((item) => (
              <li key={item.key} className={styles.attentionItem}>
                <span className={styles.attentionMark} aria-hidden="true">
                  !
                </span>
                <span className={styles.attentionText}>{item.text}</span>
                <a href={item.href}>
                  {item.action}
                  <span aria-hidden="true"> →</span>
                </a>
              </li>
            ))}
            {unavailable.map((message) => (
              <li className={styles.quietStatus} role="status" key={message}>
                {message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value === null ? "—" : value.toLocaleString("en-AU")}</dd>
      <span>{detail}</span>
    </div>
  );
}
