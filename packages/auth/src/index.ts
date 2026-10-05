export type { Principal } from "@stable/contracts";

export { normalizeAustralianMobile } from "./australian-mobile.js";
export { mapAuthError } from "./map-auth-error.js";
export {
  principalFromSession,
  type SessionIdentity,
} from "./principal-from-session.js";
export {
  LOCAL_SIGN_IN_REDIRECTS,
  assertAllowedSignInRedirect,
  assertSafeReturnPath,
  authCodeFromCallback,
} from "./auth-redirect.js";
export {
  MANUAL_LINKING_IS_ENABLED,
  PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED,
  decideIdentityLink,
} from "./identity-link-policy.js";
export type { IdentityLinkInput } from "./identity-link-policy.js";
export { createSupabaseOtpAuthClient } from "./otp-auth-client.js";
export type { OtpAuthClient, OtpProviderUser } from "./otp-auth-client.js";
export {
  completeEmailCallback,
  requestEmailSignIn,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "./sign-in.js";
export type { CompletedEmailSignIn } from "./sign-in.js";
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
