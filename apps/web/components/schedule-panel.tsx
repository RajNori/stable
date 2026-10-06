import type { ScheduleEntry } from "@stable/schedule";

type SchedulePanelProps = {
  teamName: string;
  entries: readonly ScheduleEntry[];
  error?: string | undefined;
};

export function SchedulePanel({
  teamName,
  entries,
  error,
}: SchedulePanelProps) {
  return (
    <section aria-label="Schedule">
      <h2 style={{ margin: 0 }}>Schedule for {teamName}</h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      {entries.length === 0 ? <p>No events in this range.</p> : null}
      <ul aria-label="Agenda">
        {entries.map((entry) => (
          <li key={entry.eventId}>
            {entry.eventType === "TRAINING"
              ? `Training at ${entry.startsAt}`
              : `${entry.roundLabel ?? "Game"}: ${entry.opponentName ?? "Opponent"} at ${entry.startsAt}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
