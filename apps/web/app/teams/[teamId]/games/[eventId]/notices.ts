// Success confirmations for Game Day duty actions. The query parameter is an
// allowlisted key, never free text, so a crafted URL cannot inject copy.
export const gameDayNotices = {
  "duty-acknowledged": "Duty acknowledged.",
  "duty-swap-offered":
    "Swap offered. Eligible adults on this team can now take this duty.",
  "duty-swap-accepted": "You have taken this duty.",
} as const;

export type GameDayNotice = keyof typeof gameDayNotices;

export function gameDayNoticeFrom(value: unknown): string | undefined {
  const key = Array.isArray(value) ? (value as unknown[])[0] : value;
  return typeof key === "string" && Object.hasOwn(gameDayNotices, key)
    ? gameDayNotices[key as GameDayNotice]
    : undefined;
}
