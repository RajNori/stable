import { z } from "zod";

export const IDENTITY_LINK_APPLICATIONS = [
  "same_user",
  "keep_separate",
  "allow_explicit_link",
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
    ...unchangedAdult,
  }),
  z.strictObject({
    application: z.enum(["same_user", "allow_explicit_link"]),
    providerMayAutomaticLink: z.literal(false),
    ...unchangedAdult,
  }),
  z.strictObject({
    application: z.literal("refuse"),
    errorCode: z.enum(["CONFLICT", "VALIDATION_FAILED", "UNAUTHENTICATED"]),
    providerMayAutomaticLink: z.literal(false),
    ...unchangedAdult,
  }),
]);

export type IdentityLinkDecision = z.infer<typeof identityLinkDecisionSchema>;
