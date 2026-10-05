import {
  AUTH_ERROR_MESSAGES,
  type IdentityLinkDecision,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  MANUAL_LINKING_IS_ENABLED,
  decideIdentityLink,
  type IdentityLinkInput,
} from "./identity-link-policy.js";

const unchanged = {
  createsProfile: false,
  transfersMembership: false,
  createsDuplicateIdentity: false,
} as const;

describe("identity linking policy", () => {
  it("keeps manual linking disabled until the explicit flow exists", () => {
    expect(MANUAL_LINKING_IS_ENABLED).toBe(false);
  });

  it("returns the same adult for the same email or phone", () => {
    expect(
      decideIdentityLink({ kind: "repeat_sign_in", credential: "email" }),
    ).toEqual(sameUser());
    expect(
      decideIdentityLink({ kind: "repeat_sign_in", credential: "phone" }),
    ).toEqual(sameUser());
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

  it("allows an explicit link only for an authenticated adult when the flag is on", () => {
    expect(
      decideIdentityLink({
        kind: "explicit_link",
        authenticated: true,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
      }),
    ).toEqual(allowExplicit());
    expect(
      decideIdentityLink({
        kind: "explicit_link",
        authenticated: false,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
      }),
    ).toEqual(refuse("UNAUTHENTICATED"));
    expect(
      decideIdentityLink({
        kind: "explicit_link",
        authenticated: true,
        manualLinkingEnabled: MANUAL_LINKING_IS_ENABLED,
        candidateOwnedByOtherUser: false,
      }),
    ).toEqual(refuse("CONFLICT"));
  });

  it("fails closed when the candidate credential belongs to another adult", () => {
    const decision = decideIdentityLink({
      kind: "explicit_link",
      authenticated: true,
      manualLinkingEnabled: true,
      candidateOwnedByOtherUser: true,
    });
    expect(decision).toEqual(refuse("CONFLICT"));
    if (decision.application === "refuse") {
      expect(AUTH_ERROR_MESSAGES[decision.errorCode]).toBe(
        "This sign-in method can't be added.",
      );
    }
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
    ).toEqual(refuse("VALIDATION_FAILED"));
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
    ).toEqual(refuse("UNAUTHENTICATED"));
    expect(
      decideIdentityLink({
        ...spare,
        authenticated: true,
        manualLinkingEnabled: false,
      }),
    ).toEqual(refuse("CONFLICT"));
    expect(
      decideIdentityLink({
        ...spare,
        authenticated: true,
        manualLinkingEnabled: true,
      }),
    ).toEqual(sameUser());
  });

  it("leaves the authenticated adult in place when a link is cancelled", () => {
    expect(
      decideIdentityLink({ kind: "link_cancelled", authenticated: true }),
    ).toEqual(sameUser());
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
    ).toEqual(sameUser());
    expect(
      decideIdentityLink({
        kind: "link_replay",
        alreadyLinkedToCurrentUser: false,
        alreadyLinkedToOtherUser: true,
      }),
    ).toEqual(refuse("CONFLICT"));
    expect(
      decideIdentityLink({
        kind: "link_replay",
        alreadyLinkedToCurrentUser: false,
        alreadyLinkedToOtherUser: false,
      }),
    ).toEqual(refuse("VALIDATION_FAILED"));
  });

  it("never creates a profile, moves a membership, or duplicates an identity", () => {
    const inputs: IdentityLinkInput[] = [
      { kind: "repeat_sign_in", credential: "email" },
      { kind: "unrelated_adults" },
      { kind: "resemblance", signal: "display_name" },
      {
        kind: "explicit_link",
        authenticated: true,
        manualLinkingEnabled: true,
        candidateOwnedByOtherUser: false,
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

function sameUser(): IdentityLinkDecision {
  return {
    application: "same_user",
    providerMayAutomaticLink: false,
    ...unchanged,
  };
}

function allowExplicit(): IdentityLinkDecision {
  return {
    application: "allow_explicit_link",
    providerMayAutomaticLink: false,
    ...unchanged,
  };
}

function separate(providerMayAutomaticLink: boolean): IdentityLinkDecision {
  return {
    application: "keep_separate",
    providerMayAutomaticLink,
    ...unchanged,
  };
}

function refuse(
  errorCode: "CONFLICT" | "VALIDATION_FAILED" | "UNAUTHENTICATED",
): IdentityLinkDecision {
  return {
    application: "refuse",
    errorCode,
    providerMayAutomaticLink: false,
    ...unchanged,
  };
}
