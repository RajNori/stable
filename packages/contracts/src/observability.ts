export const SENSITIVE_METADATA_FIELDS = [
  "email",
  "phone",
  "token",
  "otp",
  "playerName",
  "firstName",
  "lastName",
  "first_name",
  "last_name",
  "privateNote",
  "absenceNote",
] as const;

export type SensitiveMetadataField = (typeof SENSITIVE_METADATA_FIELDS)[number];

export type ProductEventMetadata = {
  teamId?: string;
  eventId?: string;
  clubId?: string;
  userId?: string;
};
