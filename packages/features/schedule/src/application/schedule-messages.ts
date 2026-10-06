export const scheduleMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This schedule is not available.",
  notFound: "Schedule was not found.",
  validationFailed: "Schedule details failed validation.",
  readFailed: "The schedule could not be read.",
} as const;

export const SCHEDULE_EVENT_TYPES = ["GAME", "TRAINING"] as const;

export function agendaRange(now: Date): {
  rangeStart: string;
  rangeEnd: string;
} {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 21);
  end.setUTCHours(23, 59, 59, 999);
  return {
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}
