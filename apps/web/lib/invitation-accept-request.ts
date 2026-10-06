import { invitationMessages } from "@stable/invitations";

const allowedResults: readonly string[] = [
  ...Object.values(invitationMessages),
  "Invitation could not be saved.",
];

export function allowedInvitationResult(
  value: string | string[] | undefined,
): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) {
    return undefined;
  }
  return allowedResults.includes(text) ? text : undefined;
}

export function invitationQueryRedirect(
  params: Readonly<Record<string, string | string[] | undefined>>,
): string | null {
  if (params["token"] === undefined) {
    return null;
  }
  const result = allowedInvitationResult(params["result"]);
  if (result === undefined) {
    return "/invitations/accept";
  }
  return `/invitations/accept?result=${encodeURIComponent(result)}`;
}
