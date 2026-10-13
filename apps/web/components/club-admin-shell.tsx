import type { CSSProperties, ReactNode } from "react";
import { themeFor } from "@stable/design-tokens";

import type { ClubContextPresentation } from "../lib/club-context-presentation";
import {
  WorkspaceNavigation,
  type WorkspaceNavItem,
} from "./workspace-navigation";
import styles from "./club-admin-shell.module.css";

type ClubAdminShellProps = {
  presentation: ClubContextPresentation;
  onRetry?: () => void;
  children?: ReactNode;
  accessory?: ReactNode;
  showSignedInContent?: boolean;
};

export function ClubAdminShell({
  presentation,
  onRetry,
  children,
  accessory,
  showSignedInContent = false,
}: ClubAdminShellProps) {
  const theme = themeFor("mustangs");
  const canManageClub =
    presentation.status === "member" &&
    presentation.capabilities.includes("club.manage");
  const canManagePeople =
    presentation.status === "member" &&
    presentation.capabilities.includes("people.manage");
  const canReadAudit =
    presentation.status === "member" &&
    presentation.capabilities.includes("audit.read");
  const workspaceName = canManageClub
    ? "Club administration"
    : "Team workspace";
  const navItems: WorkspaceNavItem[] = [
    { href: "/", label: "Overview", icon: "home" },
    ...(canManageClub
      ? [
          {
            href: "/club-structure",
            label: "Club structure",
            icon: "structure",
          } as const,
        ]
      : []),
    ...(canManagePeople
      ? [{ href: "/players", label: "People", icon: "people" } as const]
      : []),
    ...(canManagePeople
      ? [
          {
            href: "/notifications",
            label: "Notifications",
            icon: "notifications",
          } as const,
        ]
      : []),
    ...(canReadAudit
      ? [{ href: "/audit", label: "Operational audit", icon: "audit" } as const]
      : []),
  ];
  const themeStyle = {
    "--stable-canvas": theme.color.background.canvas,
    "--stable-surface": theme.color.background.surface,
    "--stable-surface-alt": theme.color.background.surfaceAlt,
    "--stable-inverse": theme.color.background.inverse,
    "--stable-brand": theme.color.brand.primary,
    "--stable-brand-strong": theme.color.brand.primaryStrong,
    "--stable-accent": theme.color.brand.accent,
    "--stable-accent-soft": theme.color.brand.accentSoft,
    "--stable-ink": theme.color.text.primary,
    "--stable-secondary": theme.color.text.secondary,
    "--stable-muted": theme.color.text.muted,
    "--stable-inverse-ink": theme.color.text.inverse,
    "--stable-border": theme.color.border.default,
    "--stable-border-strong": theme.color.border.strong,
    "--stable-success": theme.color.state.success,
    "--stable-success-soft": theme.color.state.successSoft,
    "--stable-warning": theme.color.state.warning,
    "--stable-warning-soft": theme.color.state.warningSoft,
    "--stable-error": theme.color.state.error,
    "--stable-error-soft": theme.color.state.errorSoft,
    "--stable-info": theme.color.state.info,
    "--stable-info-soft": theme.color.state.infoSoft,
    "--stable-shadow-sm": theme.shadow.sm,
    "--stable-shadow-md": theme.shadow.md,
  } as CSSProperties;

  return (
    <div
      className={styles.frame}
      style={themeStyle}
      data-testid="club-admin-frame"
    >
      <WorkspaceNavigation
        items={navItems}
        workspaceName={workspaceName}
        accessory={accessory}
      />
      <div className={styles.workspaceColumn}>
        <header className={styles.contextBar}>
          <div className={styles.contextClub}>
            <span className={styles.contextLabel}>Current club</span>
            <strong>
              {presentation.status === "member"
                ? presentation.clubName
                : workspaceName}
            </strong>
          </div>
          <span className={styles.contextWorkspace}>{workspaceName}</span>
        </header>
        <main className={styles.main}>
          <ClubContextPanel presentation={presentation} onRetry={onRetry} />
          {showPageContent(presentation.status, showSignedInContent) &&
          children !== undefined ? (
            <div className={styles.content} data-testid="workspace-content">
              {children}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function showPageContent(
  status: ClubContextPresentation["status"],
  showSignedInContent: boolean,
): boolean {
  if (status === "member") return true;
  return showSignedInContent && status === "no-membership";
}

function ClubContextPanel({
  presentation,
  onRetry,
}: {
  presentation: ClubContextPresentation;
  onRetry: (() => void) | undefined;
}) {
  if (presentation.status === "member") return null;

  if (presentation.status === "loading") {
    return (
      <section
        className={styles.loadingState}
        aria-label="Club context"
        data-state="loading"
        aria-busy="true"
      >
        <span className={styles.skeletonLine} aria-hidden="true" />
        <span className={styles.skeletonBlock} aria-hidden="true" />
        <span className={styles.skeletonLineShort} aria-hidden="true" />
        <span className={styles.srOnly} role="status">
          Loading club context.
        </span>
      </section>
    );
  }

  const isError = presentation.status === "error";
  return (
    <section
      className={styles.noticeState}
      data-state={presentation.status}
      aria-label="Club context"
    >
      <span className={styles.noticeIcon} aria-hidden="true">
        {isError ? "!" : "i"}
      </span>
      <div className={styles.noticeBody}>
        <h1>
          {isError
            ? "We couldn’t open your workspace"
            : "No active club access"}
        </h1>
        {presentation.status === "no-membership" ? (
          <p>Signed in as {presentation.displayName}</p>
        ) : null}
        <p role={isError ? "alert" : "status"}>{presentation.message}</p>
        <p>{presentation.nextStep}</p>
        {onRetry ? (
          <button
            type="button"
            className="stable-button stable-button--primary"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
      </div>
    </section>
  );
}
