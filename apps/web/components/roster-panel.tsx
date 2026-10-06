import type { CSSProperties } from "react";
import type { TeamRoster } from "@stable/roster";
import { themeFor } from "@stable/design-tokens";

type RosterPanelProps = {
  clubId: string;
  teamName: string;
  roster: TeamRoster;
  error?: string | undefined;
  registerPlayer?: (formData: FormData) => void | Promise<void>;
  unregisterPlayer?: (formData: FormData) => void | Promise<void>;
};

export function RosterPanel({
  clubId,
  teamName,
  roster,
  error,
  registerPlayer,
  unregisterPlayer,
}: RosterPanelProps) {
  const theme = themeFor("mustangs");
  const cardStyle: CSSProperties = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
  };
  const canChange =
    roster.canManage &&
    registerPlayer !== undefined &&
    unregisterPlayer !== undefined;

  return (
    <section aria-label="Team roster" style={cardStyle}>
      <h1
        style={{
          margin: 0,
          fontSize: theme.typeScale.headingSm.fontSize,
          lineHeight: `${theme.typeScale.headingSm.lineHeight}px`,
        }}
      >
        {teamName}
      </h1>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      <ul aria-label="Roster" style={{ marginTop: theme.space[4] }}>
        {roster.entries.map((entry) => (
          <li key={entry.playerId}>
            {entry.name}
            {canChange ? (
              <form action={unregisterPlayer}>
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="teamId" value={roster.teamId} />
                <input type="hidden" name="playerId" value={entry.playerId} />
                <button type="submit">Unregister player</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canChange ? (
        <form action={registerPlayer} style={{ marginTop: theme.space[4] }}>
          <input type="hidden" name="clubId" value={clubId} />
          <input type="hidden" name="teamId" value={roster.teamId} />
          <label htmlFor="roster-player-id">
            Player id
            <input id="roster-player-id" name="playerId" required />
          </label>
          <button type="submit">Register player</button>
        </form>
      ) : null}
    </section>
  );
}
