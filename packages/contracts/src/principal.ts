import { z } from "zod";

export const principalSchema = z
  .strictObject({
    userId: z.string().uuid(),
    displayName: z.string().min(1).optional(),
  })
  .describe(
    "Authenticated adult principal. No global role and no provider tokens.",
  );

export type Principal = z.infer<typeof principalSchema>;
