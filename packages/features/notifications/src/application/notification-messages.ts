export const NOTIFICATION_TYPES = [
  "FIXTURE_CHANGED",
  "GAME_REMINDER",
  "RSVP_REQUIRED",
  "TRAINING_CHANGED",
  "TRAINING_CANCELLED",
  "ANNOUNCEMENT_PUBLISHED",
  "DUTY_ASSIGNED",
  "DUTY_SWAP_REQUESTED",
  "DUTY_SWAP_ACCEPTED",
  "FILL_IN_REQUESTED",
  "FILL_IN_CONFIRMED",
  "COACH_CHECKED_IN",
] as const;

export const DEVICE_PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;

export const notificationMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This notification is not available.",
  notFound: "Notification was not found.",
  validationFailed: "Notification details failed validation.",
  conflict: "The notification could not be changed.",
  saveFailed: "The notification could not be saved.",
  readFailed: "Notifications could not be read.",
} as const;
