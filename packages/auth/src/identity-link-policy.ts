import {
  identityLinkDecisionSchema,
  type IdentityLinkDecision,
} from "@stable/contracts";

/**
 * OAuth manual linking uses linkIdentity and this flag.
 * Email and phone changes use authenticated updateUser and ignore this flag.
 * The flag also does not control GoTrue automatic linking of a verified OAuth email.
 */
export const MANUAL_LINKING_IS_ENABLED = false;

/**
 * Production phone changes stay closed. auth.users.phone_change is not unique,
 * and GoTrue can confirm a stale or duplicate pending number onto the wrong adult.
 */
export const PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED = false;

export type EmailChangeMode = "unset" | "double_confirm" | "new_address_only";

export type PhoneChangeState = "clear" | "stale" | "ambiguous";

export type IdentityLinkInput =
  | { readonly kind: "repeat_sign_in"; readonly credential: "email" | "phone" }
  | { readonly kind: "unrelated_adults" }
  | {
      readonly kind: "resemblance";
      readonly signal:
        | "display_name"
        | "similar_name"
        | "similar_phone"
        | "unverified_email"
        | "metadata";
    }
  | {
      readonly kind: "oauth_link";
      readonly provider: "apple" | "google";
      readonly authenticated: boolean;
      readonly manualLinkingEnabled: boolean;
      readonly candidateOwnedByOtherUser: boolean;
      readonly callbackCompleted: boolean;
    }
  | {
      readonly kind: "email_change";
      readonly authenticated: boolean;
      readonly candidateOwnedByOtherUser: boolean;
      readonly emailChangeMode: EmailChangeMode;
      readonly verificationCompleted: boolean;
    }
  | {
      readonly kind: "phone_change";
      readonly authenticated: boolean;
      readonly candidateOwnedByOtherUser: boolean;
      readonly phoneNormalized: boolean;
      readonly phoneChangeState: PhoneChangeState;
      readonly verificationCompleted: boolean;
    }
  | {
      readonly kind: "oauth_email";
      readonly providerEmailVerified: boolean;
      readonly existingAccountWithSameEmail: boolean;
      readonly autoconfirm: boolean;
    }
  | { readonly kind: "apple_private_relay" }
  | { readonly kind: "different_provider_emails" }
  | {
      readonly kind: "unlink";
      readonly authenticated: boolean;
      readonly manualLinkingEnabled: boolean;
      readonly identitiesRemainingIfRemoved: number;
    }
  | { readonly kind: "link_cancelled"; readonly authenticated: boolean }
  | {
      readonly kind: "link_replay";
      readonly alreadyLinkedToCurrentUser: boolean;
      readonly alreadyLinkedToOtherUser: boolean;
    };

export function decideIdentityLink(
  input: IdentityLinkInput,
): IdentityLinkDecision {
  switch (input.kind) {
    case "repeat_sign_in":
      return sameUser("none");
    case "unrelated_adults":
    case "resemblance":
    case "apple_private_relay":
    case "different_provider_emails":
      return separate(false);
    case "oauth_link":
      return oauthLink(input);
    case "email_change":
      return emailChange(input);
    case "phone_change":
      return phoneChange(input);
    case "oauth_email":
      return separate(providerMayLink(input));
    case "unlink":
      return unlink(input);
    case "link_cancelled":
      return input.authenticated ? sameUser("none") : separate(false);
    case "link_replay":
      return linkReplay(input);
  }
}

function oauthLink(
  input: Extract<IdentityLinkInput, { kind: "oauth_link" }>,
): IdentityLinkDecision {
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED", "link_identity");
  }
  if (input.candidateOwnedByOtherUser || !input.manualLinkingEnabled) {
    return refuse("CONFLICT", "link_identity");
  }
  return allow("link_identity", input.callbackCompleted);
}

function emailChange(
  input: Extract<IdentityLinkInput, { kind: "email_change" }>,
): IdentityLinkDecision {
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED", "update_user");
  }
  if (input.candidateOwnedByOtherUser) {
    return refuse("CONFLICT", "update_user");
  }
  if (input.emailChangeMode === "unset") {
    return refuse("VALIDATION_FAILED", "update_user");
  }
  return allow("update_user", input.verificationCompleted);
}

function phoneChange(
  input: Extract<IdentityLinkInput, { kind: "phone_change" }>,
): IdentityLinkDecision {
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED", "update_user");
  }
  if (!input.phoneNormalized) {
    return refuse("VALIDATION_FAILED", "update_user");
  }
  if (input.candidateOwnedByOtherUser) {
    return refuse("CONFLICT", "update_user");
  }
  if (input.phoneChangeState !== "clear" || !input.verificationCompleted) {
    return refuse(
      input.phoneChangeState === "clear" ? "CONFLICT" : "VALIDATION_FAILED",
      "update_user",
    );
  }
  return refuse("CONFLICT", "update_user");
}

function unlink(
  input: Extract<IdentityLinkInput, { kind: "unlink" }>,
): IdentityLinkDecision {
  if (input.identitiesRemainingIfRemoved < 1) {
    return refuse("VALIDATION_FAILED", "link_identity");
  }
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED", "link_identity");
  }
  if (!input.manualLinkingEnabled) {
    return refuse("CONFLICT", "link_identity");
  }
  return sameUser("link_identity");
}

function linkReplay(
  input: Extract<IdentityLinkInput, { kind: "link_replay" }>,
): IdentityLinkDecision {
  if (input.alreadyLinkedToOtherUser) {
    return refuse("CONFLICT", "link_identity");
  }
  if (input.alreadyLinkedToCurrentUser) {
    return sameUser("link_identity");
  }
  return refuse("VALIDATION_FAILED", "link_identity");
}

function providerMayLink(
  input: Extract<IdentityLinkInput, { kind: "oauth_email" }>,
): boolean {
  if (!input.existingAccountWithSameEmail) {
    return false;
  }
  return input.providerEmailVerified || input.autoconfirm;
}

function sameUser(mechanism: "none" | "link_identity"): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "same_user",
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished: true,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function allow(
  mechanism: "link_identity" | "update_user",
  credentialEstablished: boolean,
): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "allow_explicit_link",
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function separate(providerMayAutomaticLink: boolean): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "keep_separate",
    providerMayAutomaticLink,
    mechanism: "none",
    credentialEstablished: false,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function refuse(
  errorCode: "CONFLICT" | "VALIDATION_FAILED" | "UNAUTHENTICATED",
  mechanism: "none" | "link_identity" | "update_user",
): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "refuse",
    errorCode,
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished: false,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}
