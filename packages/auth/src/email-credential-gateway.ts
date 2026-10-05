import type { EmailCredentialGateway } from "./email-credential.js";

export type EmailCredentialApiUser = {
  readonly id: string;
  readonly email?: string;
  readonly new_email?: string | null;
};

export type EmailCredentialApi = {
  updateUser(
    attributes: { readonly email: string },
    options: { readonly emailRedirectTo: string },
  ): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  verifyOtp(params: {
    readonly email: string;
    readonly token: string;
    readonly type: "email_change";
  }): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  getUser(): Promise<{
    data: { user: EmailCredentialApiUser | null };
    error: unknown;
  }>;
};

export function createSupabaseEmailCredentialGateway(
  api: EmailCredentialApi,
): EmailCredentialGateway {
  return {
    async requestEmailChange(input) {
      const result = await api.updateUser(
        { email: input.email },
        { emailRedirectTo: input.redirectTo },
      );
      if (result.error !== null && result.error !== undefined) {
        throw result.error;
      }
      const userId = result.data.user?.id;
      if (userId === undefined) {
        throw new Error("Email change could not be started.");
      }
      return { userId };
    },
    async verifyEmailChange(input) {
      const verified = await api.verifyOtp({
        email: input.email,
        token: input.token,
        type: "email_change",
      });
      if (verified.error !== null && verified.error !== undefined) {
        throw verified.error;
      }
      const current = await api.getUser();
      if (current.error !== null && current.error !== undefined) {
        throw current.error;
      }
      const user = current.data.user;
      if (user === null) {
        throw new Error("Email change could not be checked.");
      }
      return {
        userId: user.id,
        established: emailEstablished(user, input.email),
      };
    },
  };
}

function emailEstablished(
  user: EmailCredentialApiUser,
  requested: string,
): boolean {
  if (!sameMailbox(user.email, requested)) {
    return false;
  }
  return (
    user.new_email === undefined ||
    user.new_email === null ||
    user.new_email.length === 0
  );
}

function sameMailbox(left: string | undefined, right: string): boolean {
  return left !== undefined && left.toLowerCase() === right.toLowerCase();
}
