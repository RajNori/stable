export {
  APPLICATION_ERROR_CODES,
  ApplicationError,
  applicationErrorCodeSchema,
} from "./errors.js";
export type { ApplicationErrorCode } from "./errors.js";

export { principalSchema } from "./principal.js";
export type { Principal } from "./principal.js";

export {
  CLUB_MEMBERSHIP_ROLES,
  CLUB_READ_CAPABILITY,
  KNOWN_CAPABILITIES,
} from "./capabilities.js";
export type {
  Capability,
  CapabilityDecision,
  ClubMembershipRole,
  EvaluateCapability,
  MembershipFact,
} from "./capabilities.js";

export {
  clubContextReadResultSchema,
  clubMembershipRecordSchema,
  clubSummarySchema,
  currentClubContextSchema,
} from "./current-club-context.js";
export type {
  ClubContextReadResult,
  ClubContextReader,
  ClubMembershipRecord,
  ClubSummary,
  CurrentClubContext,
  GetCurrentClubContext,
  GetCurrentClubContextInput,
} from "./current-club-context.js";

export { APP_ENV_VALUES, ENV } from "./env.js";
export type { AppEnv } from "./env.js";

export {
  CLUB_STRUCTURE_ACTIONS,
  auditEventSchema,
  clubStructureNameSchema,
  clubStructureSnapshotSchema,
  competitionSchema,
  seasonSchema,
  teamSchema,
  venueSchema,
} from "./club-structure.js";
export type {
  AuditEvent,
  ClubStructureAction,
  ClubStructureSnapshot,
  Competition,
  Season,
  Team,
  Venue,
} from "./club-structure.js";

export {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AUTH_METHODS,
  AUTH_STATES,
  INITIAL_AUTH_SESSION,
  LOGOUT_SCOPES,
  SIGN_IN_CHALLENGE_METHODS,
  authErrorCodeSchema,
  authMethodSchema,
  authSessionSnapshotSchema,
  authStateSchema,
  logoutScopeSchema,
  signInChallengeSchema,
} from "./auth-session.js";
export type {
  AuthErrorCode,
  AuthMethod,
  AuthSessionSnapshot,
  AuthState,
  LogoutScope,
  SignInChallenge,
} from "./auth-session.js";

export { identityLinkDecisionSchema } from "./identity-link.js";
export type { IdentityLinkDecision } from "./identity-link.js";

export {
  EMAIL_CREDENTIAL_CHANGE_STATUSES,
  OAUTH_LINK_PROVIDERS,
  LOCAL_SUPABASE_AUTH_ORIGIN,
  emailCredentialChangeSchema,
  isExpectedSupabaseAuthOrigin,
  isSafeOAuthAuthorizationUrl,
  oauthLinkReceiptSchema,
  oauthProviderSettingsSchema,
  oauthSignInNavigationSchema,
} from "./credential.js";
export type {
  EmailCredentialChange,
  OAuthLinkReceipt,
  OAuthProviderSettings,
  OAuthSignInNavigation,
} from "./credential.js";

export {
  PLAYER_IMPORT_MAX_ROWS,
  PLAYER_IMPORT_SOURCE,
  PLAYER_IMPORT_STATUSES,
  PLAYER_NAME_MAX_LENGTH,
  clubAdultSchema,
  guardianLinkSchema,
  normalizePlayerName,
  playerImportResultSchema,
  playerImportRowSchema,
  playerNameSchema,
  playerSchema,
  playerSummarySchema,
} from "./players.js";
export type {
  ClubAdult,
  GuardianLink,
  Player,
  PlayerImportResult,
  PlayerImportRow,
  PlayerSummary,
} from "./players.js";

export { SENSITIVE_METADATA_FIELDS } from "./observability.js";
export type {
  ProductEventMetadata,
  SensitiveMetadataField,
} from "./observability.js";
