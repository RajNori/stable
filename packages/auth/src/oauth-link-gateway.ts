import type { OAuthLinkGateway } from "./oauth-link.js";

export type OAuthLinkApi = {
  linkIdentity(credentials: {
    readonly provider: "google" | "apple";
    readonly options: {
      readonly redirectTo: string;
      readonly skipBrowserRedirect: true;
    };
  }): Promise<{
    data: { url?: string | null };
    error: unknown;
  }>;
  getUser(): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
};

export function createSupabaseOAuthLinkGateway(
  api: OAuthLinkApi,
): OAuthLinkGateway {
  return {
    async linkIdentity(input) {
      const linked = await api.linkIdentity({
        provider: input.provider,
        options: {
          redirectTo: input.redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (linked.error !== null && linked.error !== undefined) {
        throw linked.error;
      }
      const current = await api.getUser();
      if (current.error !== null && current.error !== undefined) {
        throw current.error;
      }
      const user = current.data.user;
      if (user === null) {
        throw new Error("OAuth link could not be checked.");
      }
      return { userId: user.id };
    },
  };
}
