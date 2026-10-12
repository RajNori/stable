export function formatScheduleDateTime(
  value: string,
  timeZone: string,
): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) {
    return "Time unavailable";
  }

  try {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(instant);
  } catch {
    return "Time unavailable";
  }
}
