import {
  AUTH_ERROR_MESSAGES,
  type IdentityLinkDecision,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  MANUAL_LINKING_IS_ENABLED,
  PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED,
  decideIdentityLink,
  type IdentityLinkInput,
} from "./identity-link-policy.js";

const unchanged = {
  createsProfile: false,
  transfersMembership: false,
  createsDuplicateIdentity: false,
} as const;

describe("identity linking policy", () => {
  it("keeps OAuth manual linking off and phone credential linking unimplemented", () => {
    expect(MANUAL_LINKING_IS_ENABLED).toBe(false);
    expect(PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED).toBe(false);
  });

  it("returns the same adult for the same email or phone", () => {
    expect(
      decideIdentityLink({ kind: "repeat_sign_in", credential: "email" }),
    ).toEqual(sameUser("none"));
    expect(
      decideIdentityLink({ kind: "repeat_sign_in", credential: "phone" }),
    ).toEqual(sameUser("none"));
  });

  it("keeps an email adult and an unrelated phone adult apart", () => {
    expect(decideIdentityLink({ kind: "unrelated_adults" })).toEqual(
      separate(false),
    );
  });

  it.each([
    "display_name",
    "similar_name",
    "similar_phone",
    "unverified_email",
    "metadata",
  ] as const)("does not merge adults because of %s", (signal) => {
    expect(decideIdentityLink({ kind: "resemblance", signal })).toEqual(
      separate(false),
    );
    expect(
      JSON.stringify(decideIdentityLink({ kind: "resemblance", signal })),
    ).not.toContain("@");
  });

  it("links Apple or Google with linkIdentity only for an authenticated adult when the flag is on", () => {
    expect(
      decideIdentityLink({
        kind: "oauth_link",
        provider: "google",
        authenticated: true,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
        callbackCompleted: false,
      }),
    ).toEqual(allow("link_identity", false));
    expect(
      decideIdentityLink({
        kind: "oauth_link",
        provider: "apple",
        authenticated: true,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
        callbackCompleted: true,
      }),
    ).toEqual(allow("link_identity", true));
    expect(
      decideIdentityLink({
        kind: "oauth_link",
        provider: "apple",
        authenticated: false,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
        callbackCompleted: true,
      }),
    ).toEqual(refuse("UNAUTHENTICATED", "link_identity"));
    expect(
      decideIdentityLink({
        kind: "oauth_link",
        provider: "google",
        authenticated: true,
        manualLinkingEnabled: MANUAL_LINKING_IS_ENABLED,
        candidateOwnedByOtherUser: false,
        callbackCompleted: true,
      }),
    ).toEqual(refuse("CONFLICT", "link_identity"));
  });

  it("fails closed when an OAuth identity already belongs to another adult", () => {
    const decision = decideIdentityLink({
      kind: "oauth_link",
      provider: "google",
      authenticated: true,
      manualLinkingEnabled: true,
      candidateOwnedByOtherUser: true,
      callbackCompleted: true,
    });
    expect(decision).toEqual(refuse("CONFLICT", "link_identity"));
    if (decision.application === "refuse") {
      expect(AUTH_ERROR_MESSAGES[decision.errorCode]).toBe(
        "This sign-in method can't be added.",
      );
    }
  });

  it("changes email with updateUser and waits for verification", () => {
    expect(
      decideIdentityLink({
        kind: "email_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        emailChangeMode: "double_confirm",
        verificationCompleted: false,
      }),
    ).toEqual(allow("update_user", false));
    expect(
      decideIdentityLink({
        kind: "email_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        emailChangeMode: "new_address_only",
        verificationCompleted: true,
      }),
    ).toEqual(allow("update_user", true));
    expect(
      decideIdentityLink({
        kind: "email_change",
        authenticated: false,
        candidateOwnedByOtherUser: false,
        emailChangeMode: "double_confirm",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("UNAUTHENTICATED", "update_user"));
    expect(
      decideIdentityLink({
        kind: "email_change",
        authenticated: true,
        candidateOwnedByOtherUser: true,
        emailChangeMode: "double_confirm",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("CONFLICT", "update_user"));
    expect(
      decideIdentityLink({
        kind: "email_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        emailChangeMode: "unset",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "update_user"));
  });

  it("refuses a phone credential change until phone_change cleanup is implemented", () => {
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: false,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "clear",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("UNAUTHENTICATED", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: false,
        phoneChangeState: "clear",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: true,
        phoneNormalized: true,
        phoneChangeState: "clear",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("CONFLICT", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "stale",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "ambiguous",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "clear",
        verificationCompleted: false,
      }),
    ).toEqual(refuse("CONFLICT", "update_user"));
    expect(
      decideIdentityLink({
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "clear",
        verificationCompleted: true,
      }),
    ).toEqual(refuse("CONFLICT", "update_user"));
  });

  it("records GoTrue automatic linking without an application merge", () => {
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: true,
        existingAccountWithSameEmail: true,
        autoconfirm: false,
      }),
    ).toEqual(separate(true));
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: false,
        existingAccountWithSameEmail: true,
        autoconfirm: false,
      }),
    ).toEqual(separate(false));
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: true,
        existingAccountWithSameEmail: false,
        autoconfirm: false,
      }),
    ).toEqual(separate(false));
  });

  it("shows that local autoconfirm would treat an unverified provider email as linkable", () => {
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: false,
        existingAccountWithSameEmail: true,
        autoconfirm: true,
      }),
    ).toEqual(separate(true));
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: false,
        existingAccountWithSameEmail: false,
        autoconfirm: true,
      }),
    ).toEqual(separate(false));
  });

  it("does not infer that a private relay or a different provider email is the same adult", () => {
    expect(decideIdentityLink({ kind: "apple_private_relay" })).toEqual(
      separate(false),
    );
    expect(decideIdentityLink({ kind: "different_provider_emails" })).toEqual(
      separate(false),
    );
  });

  it("refuses to remove the last sign-in identity", () => {
    expect(
      decideIdentityLink({
        kind: "unlink",
        authenticated: true,
        manualLinkingEnabled: true,
        identitiesRemainingIfRemoved: 0,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "link_identity"));
  });

  it("unlinks a spare identity only for an authenticated adult when manual linking is enabled", () => {
    const spare = {
      kind: "unlink",
      identitiesRemainingIfRemoved: 1,
    } as const;
    expect(
      decideIdentityLink({
        ...spare,
        authenticated: false,
        manualLinkingEnabled: true,
      }),
    ).toEqual(refuse("UNAUTHENTICATED", "link_identity"));
    expect(
      decideIdentityLink({
        ...spare,
        authenticated: true,
        manualLinkingEnabled: false,
      }),
    ).toEqual(refuse("CONFLICT", "link_identity"));
    expect(
      decideIdentityLink({
        ...spare,
        authenticated: true,
        manualLinkingEnabled: true,
      }),
    ).toEqual(sameUser("link_identity"));
  });

  it("leaves the authenticated adult in place when a link is cancelled", () => {
    expect(
      decideIdentityLink({ kind: "link_cancelled", authenticated: true }),
    ).toEqual(sameUser("none"));
    expect(
      decideIdentityLink({ kind: "link_cancelled", authenticated: false }),
    ).toEqual(separate(false));
  });

  it("treats a link replay as the same adult and refuses another adult's identity", () => {
    expect(
      decideIdentityLink({
        kind: "link_replay",
        alreadyLinkedToCurrentUser: true,
        alreadyLinkedToOtherUser: false,
      }),
    ).toEqual(sameUser("link_identity"));
    expect(
      decideIdentityLink({
        kind: "link_replay",
        alreadyLinkedToCurrentUser: false,
        alreadyLinkedToOtherUser: true,
      }),
    ).toEqual(refuse("CONFLICT", "link_identity"));
    expect(
      decideIdentityLink({
        kind: "link_replay",
        alreadyLinkedToCurrentUser: false,
        alreadyLinkedToOtherUser: false,
      }),
    ).toEqual(refuse("VALIDATION_FAILED", "link_identity"));
  });

  it("never creates a profile, moves a membership, or duplicates an identity", () => {
    const inputs: IdentityLinkInput[] = [
      { kind: "repeat_sign_in", credential: "email" },
      { kind: "unrelated_adults" },
      { kind: "resemblance", signal: "display_name" },
      {
        kind: "oauth_link",
        provider: "apple",
        authenticated: true,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
        callbackCompleted: true,
      },
      {
        kind: "email_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        emailChangeMode: "double_confirm",
        verificationCompleted: false,
      },
      {
        kind: "phone_change",
        authenticated: true,
        candidateOwnedByOtherUser: false,
        phoneNormalized: true,
        phoneChangeState: "clear",
        verificationCompleted: true,
      },
      {
        kind: "oauth_email",
        providerEmailVerified: true,
        existingAccountWithSameEmail: true,
        autoconfirm: false,
      },
      { kind: "apple_private_relay" },
      { kind: "different_provider_emails" },
      {
        kind: "unlink",
        authenticated: true,
        manualLinkingEnabled: true,
        identitiesRemainingIfRemoved: 0,
      },
      { kind: "link_cancelled", authenticated: true },
      {
        kind: "link_replay",
        alreadyLinkedToCurrentUser: true,
        alreadyLinkedToOtherUser: false,
      },
    ];
    for (const input of inputs) {
      const decision = decideIdentityLink(input);
      expect(decision.createsProfile).toBe(false);
      expect(decision.transfersMembership).toBe(false);
      expect(decision.createsDuplicateIdentity).toBe(false);
    }
  });
});

function sameUser(mechanism: "none" | "link_identity"): IdentityLinkDecision {
  return {
    application: "same_user",
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished: true,
    ...unchanged,
  };
}

function allow(
  mechanism: "link_identity" | "update_user",
  credentialEstablished: boolean,
): IdentityLinkDecision {
  return {
    application: "allow_explicit_link",
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished,
    ...unchanged,
  };
}

function separate(providerMayAutomaticLink: boolean): IdentityLinkDecision {
  return {
    application: "keep_separate",
    providerMayAutomaticLink,
    mechanism: "none",
    credentialEstablished: false,
    ...unchanged,
  };
}

function refuse(
  errorCode: "CONFLICT" | "VALIDATION_FAILED" | "UNAUTHENTICATED",
  mechanism: "none" | "link_identity" | "update_user",
): IdentityLinkDecision {
  return {
    application: "refuse",
    errorCode,
    providerMayAutomaticLink: false,
    mechanism,
    credentialEstablished: false,
    ...unchanged,
  };
}
