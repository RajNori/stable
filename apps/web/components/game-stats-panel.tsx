import type {
  GameCoachingStats,
  GamePlayerStatCorrection,
} from "@stable/game-day";
import { themeFor } from "@stable/design-tokens";

type GameStatsPanelProps = {
  stats: GameCoachingStats;
  corrections: readonly GamePlayerStatCorrection[];
  teamId: string;
  canWrite: boolean;
  scoreAction: (formData: FormData) => void | Promise<void>;
  playerStatAction: (formData: FormData) => void | Promise<void>;
};

export function GameStatsPanel({
  stats,
  corrections,
  teamId,
  canWrite,
  scoreAction,
  playerStatAction,
}: GameStatsPanelProps) {
  const theme = themeFor("mustangs");
  const cardStyle = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
    marginTop: theme.space[5],
  };
  const minuteMax = stats.scheduledMinutes ?? 120;

  return (
    <section aria-label="Game score and player statistics" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Game score and player stats</h2>
      <p>
        {stats.source === "MANUAL"
          ? "Stable manual result"
          : "Imported official result (read only)"}
      </p>
      {stats.source === "MANUAL" && canWrite ? (
        <form action={scoreAction}>
          <input type="hidden" name="clubId" value={stats.clubId} />
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="eventId" value={stats.eventId} />
          <label>
            Team final score
            <input
              aria-label="Team final score"
              name="teamScore"
              type="number"
              min={0}
              max={250}
              step={1}
              required
              defaultValue={stats.teamScore ?? ""}
            />
          </label>
          <label>
            Opponent final score
            <input
              aria-label="Opponent final score"
              name="opponentScore"
              type="number"
              min={0}
              max={250}
              step={1}
              required
              defaultValue={stats.opponentScore ?? ""}
            />
          </label>
          <button type="submit">Save final score</button>
        </form>
      ) : (
        <p>
          Final score: {stats.teamScore ?? "—"}–{stats.opponentScore ?? "—"}
        </p>
      )}

      <h3>Player statistics</h3>
      {corrections.length > 0 ? (
        <details>
          <summary>Restricted staff correction history</summary>
          <p>Opaque identifiers and numeric values only.</p>
          <ul aria-label="Restricted staff correction history">
            {corrections.map((correction, index) => (
              <li key={`${correction.eventId}-${correction.playerId}-${index}`}>
                <p>
                  Event {correction.eventId} · Player {correction.playerId} ·
                  Actor {correction.actorId} · {correction.occurredAt}
                </p>
                <p>
                  Before: {Object.values(correction.before).join(", ")} → After:{" "}
                  {Object.values(correction.after).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {stats.players.length === 0 ? (
        <p>No eligible players are registered.</p>
      ) : null}
      <ul
        aria-label="Player statistics"
        style={{ paddingLeft: theme.space[5] }}
      >
        {stats.players.map((player) => {
          const values = player.stat ?? {
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            fouls: 0,
            approximateMinutes: 0,
          };
          const canSave =
            canWrite && (player.activeRegistration || player.stat !== null);
          return (
            <li key={player.playerId}>
              <form action={playerStatAction}>
                <input type="hidden" name="clubId" value={stats.clubId} />
                <input type="hidden" name="teamId" value={teamId} />
                <input type="hidden" name="eventId" value={stats.eventId} />
                <input type="hidden" name="playerId" value={player.playerId} />
                <strong>{player.displayName}</strong>
                {!player.activeRegistration && player.stat !== null ? (
                  <span> (historical game record)</span>
                ) : null}
                {(
                  [
                    ["points", "Points", 100],
                    ["rebounds", "Rebounds", 100],
                    ["assists", "Assists", 100],
                    ["steals", "Steals", 100],
                    ["fouls", "Fouls", 20],
                    ["approximateMinutes", "Approximate minutes", minuteMax],
                  ] as const
                ).map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={`${label} for ${player.displayName}`}
                      name={key}
                      type="number"
                      min={0}
                      max={max}
                      step={1}
                      required
                      defaultValue={values[key]}
                      readOnly={!canSave}
                    />
                  </label>
                ))}
                {canSave ? <button type="submit">Save stats</button> : null}
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
