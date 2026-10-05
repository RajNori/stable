import { z } from "zod";

export const IDENTITY_LINK_APPLICATIONS = [
  "same_user",
  "keep_separate",
  "allow_explicit_link",
] as const;

export const IDENTITY_LINK_MECHANISMS = [
  "none",
  "link_identity",
  "update_user",
] as const;

const unchangedAdult = {
  createsProfile: z.literal(false),
  transfersMembership: z.literal(false),
  createsDuplicateIdentity: z.literal(false),
};

export const identityLinkDecisionSchema = z.discriminatedUnion("application", [
  z.strictObject({
    application: z.literal("keep_separate"),
    providerMayAutomaticLink: z.boolean(),
    mechanism: z.literal("none"),
    credentialEstablished: z.literal(false),
    ...unchangedAdult,
  }),
  z.strictObject({
    application: z.literal("same_user"),
    providerMayAutomaticLink: z.literal(false),
    mechanism: z.enum(["none", "link_identity"]),
    credentialEstablished: z.literal(true),
    ...unchangedAdult,
  }),
  z.strictObject({
    application: z.literal("allow_explicit_link"),
    providerMayAutomaticLink: z.literal(false),
    mechanism: z.enum(["link_identity", "update_user"]),
    credentialEstablished: z.boolean(),
    ...unchangedAdult,
  }),
  z.strictObject({
    application: z.literal("refuse"),
    errorCode: z.enum(["CONFLICT", "VALIDATION_FAILED", "UNAUTHENTICATED"]),
    providerMayAutomaticLink: z.literal(false),
    mechanism: z.enum(IDENTITY_LINK_MECHANISMS),
    credentialEstablished: z.literal(false),
    ...unchangedAdult,
  }),
]);

export type IdentityLinkDecision = z.infer<typeof identityLinkDecisionSchema>;
