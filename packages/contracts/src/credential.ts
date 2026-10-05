import { z } from "zod";

export const EMAIL_CREDENTIAL_CHANGE_STATUSES = [
  "pending",
  "established",
] as const;

export const emailCredentialChangeSchema = z
  .strictObject({
    status: z.enum(EMAIL_CREDENTIAL_CHANGE_STATUSES),
    userId: z.string().uuid(),
  })
  .describe(
    "Authenticated email credential change. The address stays out of this result.",
  );

export type EmailCredentialChange = z.infer<typeof emailCredentialChangeSchema>;

export const OAUTH_LINK_PROVIDERS = ["google", "apple"] as const;

export const oauthLinkReceiptSchema = z
  .strictObject({
    status: z.literal("pending"),
    provider: z.enum(OAUTH_LINK_PROVIDERS),
    userId: z.string().uuid(),
    credentialEstablished: z.literal(false),
  })
  .describe(
    "Explicit OAuth link that has not established a credential. No provider tokens.",
  );

export type OAuthLinkReceipt = z.infer<typeof oauthLinkReceiptSchema>;

export const oauthProviderSettingsSchema = z
  .strictObject({
    enabled: z.boolean(),
    clientId: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.enabled &&
      (value.clientId === null || value.clientId.trim() === "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Provider configuration is incomplete.",
      });
    }
    if (
      value.clientId !== null &&
      (value.clientId.includes("env(") || value.clientId === "local-test-otp")
    ) {
      context.addIssue({
        code: "custom",
        message: "Provider configuration is incomplete.",
      });
    }
  });

export type OAuthProviderSettings = z.infer<typeof oauthProviderSettingsSchema>;
