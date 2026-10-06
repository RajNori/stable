"use client";

import { useState } from "react";
import { TEAM_STAFF_ROLES } from "@stable/contracts";

export type InvitationView = {
  id: string;
  status: "pending" | "expired" | "consumed" | "revoked";
  label: string;
  playerId?: string | null;
  teamId?: string | null;
};

type CreateResult = { token?: string; error?: string };
type CreateAction = (formData: FormData) => Promise<CreateResult>;
type RevokeAction = (formData: FormData) => void | Promise<void>;

const ROLE_LABEL = {
  HEAD_COACH: "Head coach",
  ASSISTANT_COACH: "Assistant coach",
  TEAM_MANAGER: "Team manager",
} as const;

export function InvitationPanel({
  invitations,
  hidden,
  includeRole,
  createInvitation,
  revokeInvitation,
}: {
  invitations: readonly InvitationView[];
  hidden: Readonly<Record<string, string>>;
  includeRole: boolean;
  createInvitation: CreateAction;
  revokeInvitation: RevokeAction;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h3 style={{ marginBottom: 0 }}>Invitations</h3>
      <ul aria-label="Invitations">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            {invitation.label} {invitation.status}
            {invitation.status === "pending" ? (
              <form action={revokeInvitation}>
                {Object.entries(hidden).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <input
                  type="hidden"
                  name="invitationId"
                  value={invitation.id}
                />
                <button type="submit">Revoke invitation</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        action={async (formData) => {
          const result = await createInvitation(formData);
          if (result.error !== undefined) {
            setLink(null);
            setError(result.error);
            return;
          }
          if (result.token === undefined) {
            setLink(null);
            setError("Invitation could not be saved.");
            return;
          }
          setError(null);
          setLink(
            `${window.location.origin}/invitations/accept?token=${result.token}`,
          );
        }}
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label
          htmlFor={`invite-email-${hidden["playerId"] ?? hidden["teamId"]}`}
        >
          Invitation email
          <input
            id={`invite-email-${hidden["playerId"] ?? hidden["teamId"]}`}
            name="intendedEmail"
            type="email"
            autoComplete="off"
          />
        </label>
        <label
          htmlFor={`invite-phone-${hidden["playerId"] ?? hidden["teamId"]}`}
        >
          Invitation phone
          <input
            id={`invite-phone-${hidden["playerId"] ?? hidden["teamId"]}`}
            name="intendedPhone"
            type="tel"
            autoComplete="off"
          />
        </label>
        {includeRole ? (
          <label htmlFor={`invite-role-${hidden["teamId"]}`}>
            Invitation role
            <select
              id={`invite-role-${hidden["teamId"]}`}
              name="inviteType"
              defaultValue="HEAD_COACH"
            >
              {TEAM_STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="inviteType" value="GUARDIAN" />
        )}
        <button type="submit">Create invitation</button>
      </form>
      {error === null ? null : <p role="alert">{error}</p>}
      {link === null ? null : (
        <p>
          Copy this invitation link. It is shown once.
          <input readOnly value={link} aria-label="Invitation link" />
        </p>
      )}
    </div>
  );
}
