import {
  identityLinkDecisionSchema,
  type IdentityLinkDecision,
} from "@stable/contracts";

/**
 * V1 will add a second credential only while the adult is already signed in.
 * `enable_manual_linking` stays false until that flow is implemented.
 * Turning the flag on is a deliberate local Auth change. It does not control
 * GoTrue automatic linking of a verified OAuth email.
 */
export const MANUAL_LINKING_IS_ENABLED = false;

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
      readonly kind: "explicit_link";
      readonly authenticated: boolean;
      readonly manualLinkingEnabled: boolean;
      readonly candidateOwnedByOtherUser: boolean;
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
      return sameUser();
    case "unrelated_adults":
    case "resemblance":
    case "apple_private_relay":
    case "different_provider_emails":
      return separate(false);
    case "explicit_link":
      return explicitLink(input);
    case "oauth_email":
      return separate(providerMayLink(input));
    case "unlink":
      return unlink(input);
    case "link_cancelled":
      return input.authenticated ? sameUser() : separate(false);
    case "link_replay":
      return linkReplay(input);
  }
}

function explicitLink(
  input: Extract<IdentityLinkInput, { kind: "explicit_link" }>,
): IdentityLinkDecision {
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED");
  }
  if (input.candidateOwnedByOtherUser || !input.manualLinkingEnabled) {
    return refuse("CONFLICT");
  }
  return allowExplicitLink();
}

function unlink(
  input: Extract<IdentityLinkInput, { kind: "unlink" }>,
): IdentityLinkDecision {
  if (input.identitiesRemainingIfRemoved < 1) {
    return refuse("VALIDATION_FAILED");
  }
  if (!input.authenticated) {
    return refuse("UNAUTHENTICATED");
  }
  if (!input.manualLinkingEnabled) {
    return refuse("CONFLICT");
  }
  return sameUser();
}

function linkReplay(
  input: Extract<IdentityLinkInput, { kind: "link_replay" }>,
): IdentityLinkDecision {
  if (input.alreadyLinkedToOtherUser) {
    return refuse("CONFLICT");
  }
  if (input.alreadyLinkedToCurrentUser) {
    return sameUser();
  }
  return refuse("VALIDATION_FAILED");
}

function providerMayLink(
  input: Extract<IdentityLinkInput, { kind: "oauth_email" }>,
): boolean {
  if (!input.existingAccountWithSameEmail) {
    return false;
  }
  return input.providerEmailVerified || input.autoconfirm;
}

function sameUser(): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "same_user",
    providerMayAutomaticLink: false,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function allowExplicitLink(): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "allow_explicit_link",
    providerMayAutomaticLink: false,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function separate(providerMayAutomaticLink: boolean): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "keep_separate",
    providerMayAutomaticLink,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}

function refuse(
  errorCode: "CONFLICT" | "VALIDATION_FAILED" | "UNAUTHENTICATED",
): IdentityLinkDecision {
  return identityLinkDecisionSchema.parse({
    application: "refuse",
    errorCode,
    providerMayAutomaticLink: false,
    createsProfile: false,
    transfersMembership: false,
    createsDuplicateIdentity: false,
  });
}
