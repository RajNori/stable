import { invitationMessages } from "@stable/invitations";

import { ClubAdminShell } from "../../../components/club-admin-shell";
import { loadLiveClubContext } from "../../../lib/load-live-club-context";
import { acceptInvitationAction } from "../actions";

export const dynamic = "force-dynamic";

type AcceptPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptPageProps) {
  const params = await searchParams;
  const result = allowedResult(params["result"]);
  const token = firstText(params["token"]);
  const presentation = await loadLiveClubContext();

  return (
    <ClubAdminShell presentation={presentation} showSignedInContent>
      <section aria-label="Accept invitation">
        <h1>Invitation</h1>
        {result !== undefined ? <p role="status">{result}</p> : null}
        {result === undefined && token !== undefined ? (
          <form action={acceptInvitationAction}>
            <input type="hidden" name="token" value={token} />
            <button type="submit">Accept invitation</button>
          </form>
        ) : null}
        {result === undefined && token === undefined ? (
          <p role="alert">{invitationMessages.notFound}</p>
        ) : null}
      </section>
    </ClubAdminShell>
  );
}

function firstText(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined || !/^[0-9a-f]{64}$/.test(text)) {
    return undefined;
  }
  return text;
}

function allowedResult(
  value: string | string[] | undefined,
): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === undefined) {
    return undefined;
  }
  const allowed: readonly string[] = [
    ...Object.values(invitationMessages),
    "Invitation could not be saved.",
  ];
  return allowed.includes(text) ? text : undefined;
}
