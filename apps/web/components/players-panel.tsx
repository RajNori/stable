import type { CSSProperties } from "react";
import { themeFor } from "@stable/design-tokens";

import { PlayerImportForm } from "./player-import-form";

export type ManagedPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  registeredName: string;
  displayName: string;
  active: boolean;
  guardians: readonly {
    id: string;
    guardianUserId: string;
    active: boolean;
    label: string;
  }[];
};

export type ClubAdultOption = {
  userId: string;
  displayName: string;
};

type FormAction = (formData: FormData) => void | Promise<void>;

type PlayersPanelProps = {
  clubId: string | null;
  players: readonly ManagedPlayer[];
  adults: readonly ClubAdultOption[];
  createPlayer: FormAction;
  importPlayers: FormAction;
  updatePlayer: FormAction;
  deactivatePlayer: FormAction;
  reactivatePlayer: FormAction;
  linkGuardian: FormAction;
  unlinkGuardian: FormAction;
  error?: string | undefined;
};

export function PlayersPanel({
  clubId,
  players,
  adults,
  createPlayer,
  importPlayers,
  updatePlayer,
  deactivatePlayer,
  reactivatePlayer,
  linkGuardian,
  unlinkGuardian,
  error,
}: PlayersPanelProps) {
  const theme = themeFor("mustangs");
  const cardStyle: CSSProperties = {
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.sm,
    padding: theme.space[6],
  };

  return (
    <section aria-label="Players" style={cardStyle}>
      <h2
        style={{
          margin: 0,
          fontSize: theme.typeScale.headingSm.fontSize,
          lineHeight: `${theme.typeScale.headingSm.lineHeight}px`,
          fontWeight: theme.typeScale.headingSm.fontWeight,
        }}
      >
        Players
      </h2>
      {error !== undefined ? <p role="alert">{error}</p> : null}
      <ul
        aria-label="Players"
        style={{
          margin: `${theme.space[4]}px 0 0`,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: theme.space[4],
        }}
      >
        {players.map((player) => (
          <li
            key={player.id}
            style={{
              border: `1px solid ${theme.color.border.default}`,
              borderRadius: theme.radius.sm,
              padding: theme.space[4],
            }}
          >
            <p style={{ margin: 0 }}>{player.registeredName}</p>
            <p
              style={{
                margin: `${theme.space[2]}px 0 0`,
                color: theme.color.text.secondary,
              }}
            >
              Shown to guardians as {player.displayName}
            </p>
            <p style={{ margin: `${theme.space[2]}px 0 0` }}>
              {player.active ? "Active" : "Inactive"}
            </p>
            <form action={updatePlayer} style={{ marginTop: theme.space[4] }}>
              <input type="hidden" name="playerId" value={player.id} />
              <label htmlFor={`given-${player.id}`}>
                Given name
                <input
                  id={`given-${player.id}`}
                  name="firstName"
                  defaultValue={player.firstName}
                  maxLength={80}
                  required
                  style={inputStyle(theme)}
                />
              </label>
              <label htmlFor={`surname-${player.id}`}>
                Surname
                <input
                  id={`surname-${player.id}`}
                  name="lastName"
                  defaultValue={player.lastName}
                  maxLength={80}
                  required
                  style={inputStyle(theme)}
                />
              </label>
              <button type="submit" style={primaryButton(theme)}>
                Save name
              </button>
            </form>
            <form action={player.active ? deactivatePlayer : reactivatePlayer}>
              <input type="hidden" name="playerId" value={player.id} />
              <button type="submit" style={secondaryButton(theme)}>
                {player.active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
            <ul aria-label={`Guardians for ${player.displayName}`}>
              {player.guardians.map((guardian) => (
                <li key={guardian.id}>
                  {guardian.label}
                  {guardian.active ? "" : " (unlinked)"}
                  {guardian.active ? (
                    <form action={unlinkGuardian}>
                      <input type="hidden" name="playerId" value={player.id} />
                      <input
                        type="hidden"
                        name="guardianUserId"
                        value={guardian.guardianUserId}
                      />
                      <button type="submit" style={secondaryButton(theme)}>
                        Unlink
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {adults.length === 0 ? (
              <p>No club adults are available to link.</p>
            ) : (
              <LinkGuardianForm
                playerId={player.id}
                adults={adults}
                action={linkGuardian}
              />
            )}
          </li>
        ))}
      </ul>
      {clubId === null ? null : (
        <div
          style={{
            marginTop: theme.space[6],
            display: "grid",
            gap: theme.space[6],
          }}
        >
          <section aria-label="Add player">
            <form action={createPlayer}>
              <h3 style={{ margin: 0 }}>Add player</h3>
              <input type="hidden" name="clubId" value={clubId} />
              <label htmlFor="new-given-name">
                Given name
                <input
                  id="new-given-name"
                  name="firstName"
                  required
                  maxLength={80}
                  style={inputStyle(theme)}
                />
              </label>
              <label htmlFor="new-surname">
                Surname
                <input
                  id="new-surname"
                  name="lastName"
                  required
                  maxLength={80}
                  style={inputStyle(theme)}
                />
              </label>
              <button type="submit" style={primaryButton(theme)}>
                Add player
              </button>
            </form>
          </section>
          <section aria-label="Import players">
            <h3 style={{ margin: 0 }}>Import players</h3>
            <PlayerImportForm clubId={clubId} action={importPlayers} />
          </section>
        </div>
      )}
    </section>
  );
}

function LinkGuardianForm({
  playerId,
  adults,
  action,
}: {
  playerId: string;
  adults: readonly ClubAdultOption[];
  action: FormAction;
}) {
  const theme = themeFor("mustangs");
  const first = adults[0];
  if (first === undefined) {
    return <p>No club adults are available to link.</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="playerId" value={playerId} />
      <label htmlFor={`adult-${playerId}`}>
        Club adult
        <select
          id={`adult-${playerId}`}
          name="guardianUserId"
          defaultValue={first.userId}
          style={inputStyle(theme)}
        >
          {adults.map((adult) => (
            <option key={adult.userId} value={adult.userId}>
              {adult.displayName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" style={primaryButton(theme)}>
        Link guardian
      </button>
    </form>
  );
}

function inputStyle(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginTop: theme.space[2],
    minHeight: 44,
    padding: `0 ${theme.space[3]}px`,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.sm,
    background: theme.color.background.canvas,
    color: theme.color.text.primary,
  };
}

function primaryButton(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    minHeight: 44,
    marginTop: theme.space[3],
    padding: `0 ${theme.space[4]}px`,
    background: theme.color.brand.primary,
    color: theme.color.text.inverse,
    border: `1px solid ${theme.color.brand.primary}`,
    borderRadius: theme.radius.sm,
  };
}

function secondaryButton(theme: ReturnType<typeof themeFor>): CSSProperties {
  return {
    minHeight: 44,
    marginTop: theme.space[3],
    padding: `0 ${theme.space[4]}px`,
    background: theme.color.background.surface,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.default}`,
    borderRadius: theme.radius.sm,
  };
}
