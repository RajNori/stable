export const ANNOUNCEMENT_CATEGORIES = [
  "GENERAL",
  "FIXTURE",
  "TRAINING",
  "DUTY",
] as const;

export const ANNOUNCEMENT_IMPORTANCE = ["NORMAL", "IMPORTANT"] as const;

export const announcementMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This announcement is not available.",
  notFound: "Announcement was not found.",
  validationFailed: "Announcement details failed validation.",
  conflict: "The announcement could not be changed.",
  saveFailed: "The announcement could not be saved.",
  readFailed: "Announcements could not be read.",
} as const;
