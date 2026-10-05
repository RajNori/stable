import type { CSSProperties, ReactNode } from "react";
import { themeFor } from "@stable/design-tokens";

import type { ClubContextPresentation } from "../lib/club-context-presentation";

type ClubAdminShellProps = {
  presentation: ClubContextPresentation;
  onRetry?: () => void;
  children?: ReactNode;
};

export function ClubAdminShell({
  presentation,
  onRetry,
  children,
}: ClubAdminShellProps) {
  const theme = themeFor("mustangs");
  const frameStyle: CSSProperties & { "--admin-gap": string } = {
    background: theme.color.background.canvas,
    color: theme.color.text.primary,
    "--admin-gap": `${theme.space[6]}px`,
  };
  const sidebarStyle: CSSProperties = {
    background: theme.color.background.inverse,
    color: theme.color.text.inverse,
    borderTop: `4px solid ${theme.color.brand.accent}`,
    padding: theme.space[6],
  };
  const mainStyle: CSSProperties = {
    padding: theme.space[8],
    minWidth: 0,
  };
  const cardStyle: CSSProperties = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
  };

  return (
    <div
      className="club-admin-frame"
      data-testid="club-admin-frame"
      style={frameStyle}
    >
      <style>{`
        .club-admin-frame {
          display: grid;
          grid-template-columns: 16rem minmax(0, 1fr);
          min-height: 100vh;
        }
        .club-admin-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.8fr);
          gap: var(--admin-gap);
          align-items: start;
        }
        @media (max-width: 960px) {
          .club-admin-frame {
            grid-template-columns: minmax(0, 1fr);
          }
          .club-admin-main-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
      <aside aria-label="Club administration" style={sidebarStyle}>
        <p
          style={{
            margin: 0,
            fontSize: theme.typeScale.labelSm.fontSize,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: theme.color.brand.accent,
          }}
        >
          The Stable
        </p>
        <p
          style={{
            margin: `${theme.space[2]}px 0 0`,
            fontSize: theme.typeScale.headingSm.fontSize,
            fontWeight: theme.typeScale.headingSm.fontWeight,
            lineHeight: `${theme.typeScale.headingSm.lineHeight}px`,
          }}
        >
          Club administration
        </p>
        <nav aria-label="Admin sections" style={{ marginTop: theme.space[8] }}>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: theme.space[3],
            }}
          >
            <li>Overview</li>
            <li>Needs attention</li>
            {presentation.status === "member" ? (
              <li>
                <a href="/club-structure">Club structure</a>
              </li>
            ) : null}
            <li>
              <a href="/club-settings" hidden data-testid="admin-chrome-link">
                Club settings
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <main style={mainStyle}>
        <ClubContextPanel
          presentation={presentation}
          cardStyle={cardStyle}
          onRetry={onRetry}
        />
        {presentation.status === "member" && children !== undefined ? (
          <div style={{ marginTop: theme.space[6] }}>{children}</div>
        ) : null}
      </main>
    </div>
  );
}

function ClubContextPanel({
  presentation,
  cardStyle,
  onRetry,
}: {
  presentation: ClubContextPresentation;
  cardStyle: CSSProperties;
  onRetry: (() => void) | undefined;
}) {
  const theme = themeFor("mustangs");

  if (presentation.status === "loading") {
    return (
      <section
        aria-label="Club context"
        aria-busy="true"
        data-state="loading"
        style={cardStyle}
      >
        <h1 style={headingStyle(theme)}>Club administration</h1>
        <p role="status">Loading club context.</p>
      </section>
    );
  }

  if (presentation.status === "member") {
    const capabilityText =
      presentation.capabilities.length === 0
        ? "none granted"
        : presentation.capabilities.join(", ");

    return (
      <section aria-label="Club context" data-state="member">
        <div className="club-admin-main-grid">
          <article style={cardStyle}>
            <p
              style={{
                margin: 0,
                color: theme.color.text.secondary,
                fontSize: theme.typeScale.labelMd.fontSize,
              }}
            >
              Current club
            </p>
            <h1 style={headingStyle(theme)}>{presentation.clubName}</h1>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "10rem minmax(0, 1fr)",
                gap: theme.space[3],
                margin: `${theme.space[6]}px 0 0`,
              }}
            >
              <dt style={{ color: theme.color.text.secondary }}>
                Display name
              </dt>
              <dd style={{ margin: 0 }}>{presentation.displayName}</dd>
              <dt style={{ color: theme.color.text.secondary }}>
                Capabilities
              </dt>
              <dd style={{ margin: 0 }}>{capabilityText}</dd>
            </dl>
          </article>
          <article style={cardStyle}>
            <h2 style={subheadingStyle(theme)}>Needs attention</h2>
            <p style={{ color: theme.color.text.secondary }}>
              Nothing needs attention in this club yet.
            </p>
          </article>
        </div>
      </section>
    );
  }

  const statusRole = presentation.status === "error" ? "alert" : "status";

  return (
    <section
      aria-label="Club context"
      data-state={presentation.status}
      style={cardStyle}
    >
      <h1 style={headingStyle(theme)}>Club administration</h1>
      {presentation.status === "no-membership" ? (
        <p style={{ color: theme.color.text.secondary }}>
          Signed in as {presentation.displayName}
        </p>
      ) : null}
      <p role={statusRole}>{presentation.message}</p>
      <p>
        <strong>Next step. </strong>
        {presentation.nextStep}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            minHeight: 44,
            padding: `0 ${theme.space[4]}px`,
            background: theme.color.brand.primary,
            color: theme.color.text.inverse,
            border: `1px solid ${theme.color.brand.primary}`,
            borderRadius: theme.radius.sm,
          }}
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}

function headingStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    margin: `${theme.space[2]}px 0 0`,
    fontSize: theme.typeScale.headingLg.fontSize,
    lineHeight: `${theme.typeScale.headingLg.lineHeight}px`,
    fontWeight: theme.typeScale.headingLg.fontWeight,
  };
}

function subheadingStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    margin: 0,
    fontSize: theme.typeScale.headingSm.fontSize,
    lineHeight: `${theme.typeScale.headingSm.lineHeight}px`,
    fontWeight: theme.typeScale.headingSm.fontWeight,
  };
}
