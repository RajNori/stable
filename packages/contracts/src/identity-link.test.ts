import { describe, expect, it } from "vitest";

import { identityLinkDecisionSchema } from "./identity-link.js";

const unchanged = {
  createsProfile: false,
  transfersMembership: false,
  createsDuplicateIdentity: false,
} as const;

describe("identity link decision contract", () => {
  it("accepts a provider automatic-link fact without an application merge", () => {
    expect(
      identityLinkDecisionSchema.parse({
        application: "keep_separate",
        providerMayAutomaticLink: true,
        ...unchanged,
      }),
    ).toEqual({
      application: "keep_separate",
      providerMayAutomaticLink: true,
      ...unchanged,
    });
  });

  it("rejects a second profile, a membership move, or a leaked email", () => {
    expect(
      identityLinkDecisionSchema.safeParse({
        application: "same_user",
        providerMayAutomaticLink: false,
        createsProfile: true,
        transfersMembership: false,
        createsDuplicateIdentity: false,
      }).success,
    ).toBe(false);
    expect(
      identityLinkDecisionSchema.safeParse({
        application: "keep_separate",
        providerMayAutomaticLink: false,
        email: "adult@example.com",
        ...unchanged,
      }).success,
    ).toBe(false);
    expect(
      identityLinkDecisionSchema.safeParse({
        application: "allow_explicit_link",
        providerMayAutomaticLink: true,
        ...unchanged,
      }).success,
    ).toBe(false);
  });
});
