export const gameDayMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This game day is not available.",
  notFound: "Game day was not found.",
  validationFailed: "Game day details failed validation.",
  conflict: "The duty allocation is out of date.",
  saveFailed: "The duty could not be saved.",
  readFailed: "Game day could not be read.",
} as const;

export const DUTY_TYPES = ["SCORER", "CLOCK", "CANTEEN", "OTHER"] as const;
export const RSVP_STATUSES = [
  "UNANSWERED",
  "ATTENDING",
  "UNAVAILABLE",
  "UNSURE",
] as const;
export const OWN_RSVP = "UNANSWERED" as const;
