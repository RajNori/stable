export type OtpProviderUser = {
  readonly id: string;
  readonly displayName?: string;
};

export type EmailOtpRequest = {
  readonly email: string;
  readonly options: {
    readonly emailRedirectTo: string;
    readonly shouldCreateUser: true;
  };
};

export type PhoneOtpRequest = {
  readonly phone: string;
  readonly options: {
    readonly channel: "sms";
    readonly shouldCreateUser: true;
  };
};

export type VerifyEmailOtp = {
  readonly email: string;
  readonly token: string;
  readonly type: "email";
};

export type VerifyPhoneOtp = {
  readonly phone: string;
  readonly token: string;
  readonly type: "sms";
};

export type OtpAuthResult = {
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly user_metadata?: unknown;
    } | null;
    readonly session: {
      readonly access_token?: string;
      readonly refresh_token?: string;
      readonly expires_at?: number;
    } | null;
  };
  readonly error: unknown;
};

export type SupabaseOtpApi = {
  signInWithOtp(
    credentials: EmailOtpRequest | PhoneOtpRequest,
  ): Promise<{ error: unknown }>;
  verifyOtp(params: VerifyEmailOtp | VerifyPhoneOtp): Promise<OtpAuthResult>;
  exchangeCodeForSession(code: string): Promise<OtpAuthResult>;
};

export type OtpAuthClient = {
  requestEmailOtp(input: { email: string; redirectTo: string }): Promise<void>;
  verifyEmailOtp(input: {
    email: string;
    token: string;
  }): Promise<OtpProviderUser>;
  exchangeEmailCode(input: { code: string }): Promise<OtpProviderUser>;
  requestPhoneOtp(input: { phoneE164: string }): Promise<void>;
  verifyPhoneOtp(input: {
    phoneE164: string;
    token: string;
  }): Promise<OtpProviderUser>;
};

function displayNameFromMetadata(metadata: unknown): string | undefined {
  if (typeof metadata !== "object" || metadata === null) {
    return undefined;
  }

  if (!("display_name" in metadata)) {
    return undefined;
  }

  const value: unknown = metadata.display_name;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return value;
}

function providerUser(result: OtpAuthResult): OtpProviderUser {
  if (result.error !== null && result.error !== undefined) {
    throw result.error;
  }

  const user = result.data.user;
  if (user === null) {
    throw new Error("Sign-in could not be completed.");
  }

  const displayName = displayNameFromMetadata(user.user_metadata);
  if (displayName === undefined) {
    return { id: user.id };
  }

  return { id: user.id, displayName };
}

export function createSupabaseOtpAuthClient(
  api: SupabaseOtpApi,
): OtpAuthClient {
  return {
    async requestEmailOtp(input) {
      const result = await api.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo: input.redirectTo,
          shouldCreateUser: true,
        },
      });
      if (result.error !== null && result.error !== undefined) {
        throw result.error;
      }
    },
    async verifyEmailOtp(input) {
      return providerUser(
        await api.verifyOtp({
          email: input.email,
          token: input.token,
          type: "email",
        }),
      );
    },
    async exchangeEmailCode(input) {
      return providerUser(await api.exchangeCodeForSession(input.code));
    },
    async requestPhoneOtp(input) {
      const result = await api.signInWithOtp({
        phone: input.phoneE164,
        options: { channel: "sms", shouldCreateUser: true },
      });
      if (result.error !== null && result.error !== undefined) {
        throw result.error;
      }
    },
    async verifyPhoneOtp(input) {
      return providerUser(
        await api.verifyOtp({
          phone: input.phoneE164,
          token: input.token,
          type: "sms",
        }),
      );
    },
  };
}
