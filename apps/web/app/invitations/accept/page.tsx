import { invitationMessages } from "@stable/invitations";
import { redirect } from "next/navigation";

import { AcceptInvitationHandoff } from "../../../components/accept-invitation-handoff";
import { ClubAdminShell } from "../../../components/club-admin-shell";
import { loadLiveClubContext } from "../../../lib/load-live-club-context";
import {
  allowedInvitationResult,
  invitationQueryRedirect,
} from "../../../lib/invitation-accept-request";
import { acceptInvitationAction } from "../actions";

export const dynamic = "force-dynamic";

type AcceptPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptPageProps) {
  const params = await searchParams;
  const redirectTo = invitationQueryRedirect(params);
  if (redirectTo !== null) {
    redirect(redirectTo);
  }
  const result = allowedInvitationResult(params["result"]);
  const presentation = await loadLiveClubContext();

  return (
    <ClubAdminShell presentation={presentation} showSignedInContent>
      <section aria-label="Accept invitation">
        <h1>Invitation</h1>
        {result !== undefined ? (
          <p role="status">{result}</p>
        ) : (
          <AcceptInvitationHandoff
            action={acceptInvitationAction}
            notFoundMessage={invitationMessages.notFound}
          />
        )}
      </section>
    </ClubAdminShell>
  );
}
