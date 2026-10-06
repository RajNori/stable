export const attendanceMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This attendance action is not allowed.",
  notFound: "Attendance was not found.",
  validationFailed: "Attendance details failed validation.",
  saveFailed: "Attendance could not be saved.",
  readFailed: "Attendance could not be read.",
} as const;

export const ATTENDANCE_STATUSES = [
  "ATTENDING",
  "UNAVAILABLE",
  "UNSURE",
] as const;
export const ABSENCE_CATEGORIES = [
  "SICK",
  "INJURY",
  "FAMILY",
  "OTHER",
] as const;
