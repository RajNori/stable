export type { Principal } from "@stable/contracts";

export { normalizeAustralianMobile } from "./australian-mobile.js";
export { mapAuthError } from "./map-auth-error.js";
export {
  principalFromSession,
  type SessionIdentity,
} from "./principal-from-session.js";
export {
  providerFailureRead,
  refreshAuthSession,
  restoreAuthSession,
  signOutAuthSession,
} from "./auth-session.js";
export type {
  AuthSessionDecision,
  AuthSessionGateway,
  PersistedSessionRead,
  StoredPrincipalFact,
} from "./auth-session.js";
