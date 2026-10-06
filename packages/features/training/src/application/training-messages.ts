export const trainingMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This training action is not allowed.",
  notFound: "Training was not found.",
  validationFailed: "Training details failed validation.",
  conflict: "This training session is already checked in.",
  saveFailed: "Training could not be saved.",
  readFailed: "Training could not be read.",
} as const;

export const TRAINING_HORIZON_WEEKS = 16;
