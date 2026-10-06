const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function invitationAcceptanceUrl(origin: string, token: string): string {
  const url = new URL("/invitations/accept", origin);
  url.hash = token;
  return url.toString();
}

export function readFragmentToken(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return TOKEN_PATTERN.test(raw) ? raw : null;
}

export function scrubbedAcceptanceUrl(current: URL): string {
  const url = new URL(current.href);
  url.hash = "";
  url.searchParams.delete("token");
  return `${url.pathname}${url.search}`;
}
