import { ChevronDown, UsersRound } from "lucide-react";
import styles from "./players-panel.module.css";

import { InvitationPanel, type InvitationView } from "./invitation-panel";
import { PlayerImportForm } from "./player-import-form";

export type ManagedPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  registeredName: string;
  displayName: string;
  active: boolean;
  teamName?: string | null;
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
  teams?: readonly { id: string; name: string }[];
  registerPlayer?: FormAction;
  unregisterPlayer?: FormAction;
  invitations?: readonly InvitationView[];
  createInvitation?: (
    formData: FormData,
  ) => Promise<{ token?: string; error?: string }>;
  revokeInvitation?: FormAction;
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
  teams = [],
  registerPlayer,
  unregisterPlayer,
  invitations = [],
  createInvitation,
  revokeInvitation,
  error,
}: PlayersPanelProps) {
  return (
    <section className={styles.panel} aria-label="Players">
      <header className={styles.pageHeader}>
        <span className={styles.pageIcon} aria-hidden="true">
          <UsersRound size={19} />
        </span>
        <div>
          <p className={styles.kicker}>Club operations</p>
          <h1>Players</h1>
          <p>Manage player details, team registration and guardian links.</p>
        </div>
      </header>
      {error !== undefined ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {players.length === 0 ? (
        <p className={styles.empty}>No players have been added yet.</p>
      ) : null}
      <ul aria-label="Players" className={styles.playerList}>
        {players.map((player) => (
          <li key={player.id} className={styles.playerRecord}>
            <header className={styles.playerHeading}>
              <span className={styles.playerMark} aria-hidden="true">
                {player.registeredName.trim().charAt(0).toUpperCase()}
              </span>
              <div className={styles.playerIdentity}>
                <h2>{player.registeredName}</h2>
                <p>
                  Guardian display name: <strong>{player.displayName}</strong>
                </p>
              </div>
              <div className={styles.playerStatus}>
                <span
                  className={player.active ? styles.active : styles.inactive}
                >
                  {player.active ? "Active" : "Inactive"}
                </span>
                <span className={styles.teamName}>
                  {player.teamName ?? "No team"}
                </span>
              </div>
            </header>
            <details className={styles.playerDetails}>
              <summary>
                Manage profile and access
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className={styles.playerBody}>
                <section
                  className={styles.managementGroup}
                  aria-label={`Player registration for ${player.displayName}`}
                >
                  <h3>Team registration</h3>
                  {registerPlayer !== undefined && teams.length > 0 ? (
                    <form action={registerPlayer} className={styles.inlineForm}>
                      <input type="hidden" name="clubId" value={clubId ?? ""} />
                      <input type="hidden" name="playerId" value={player.id} />
                      <label htmlFor={`team-${player.id}`}>
                        Team
                        <select
                          id={`team-${player.id}`}
                          name="teamId"
                          defaultValue={teams[0]?.id}
                        >
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="stable-button stable-button--primary"
                      >
                        Register team
                      </button>
                    </form>
                  ) : null}
                  {unregisterPlayer !== undefined && player.teamName != null ? (
                    <form
                      action={unregisterPlayer}
                      className={styles.inlineForm}
                    >
                      <input type="hidden" name="clubId" value={clubId ?? ""} />
                      <input type="hidden" name="playerId" value={player.id} />
                      <button
                        type="submit"
                        className="stable-button stable-button--secondary"
                      >
                        Unregister team
                      </button>
                    </form>
                  ) : null}
                  <form action={updatePlayer} className={styles.nameForm}>
                    <h3>Player details</h3>
                    <input type="hidden" name="playerId" value={player.id} />
                    <label htmlFor={`given-${player.id}`}>
                      Given name
                      <input
                        id={`given-${player.id}`}
                        name="firstName"
                        defaultValue={player.firstName}
                        maxLength={80}
                        required
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
                      />
                    </label>
                    <button
                      type="submit"
                      className="stable-button stable-button--primary"
                    >
                      Save name
                    </button>
                  </form>
                  <form
                    action={player.active ? deactivatePlayer : reactivatePlayer}
                    className={styles.statusForm}
                  >
                    <input type="hidden" name="playerId" value={player.id} />
                    <button
                      type="submit"
                      className="stable-button stable-button--secondary"
                    >
                      {player.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </section>
                <section
                  className={styles.managementGroup}
                  aria-label={`Guardians for ${player.displayName}`}
                >
                  <h3>Guardian links</h3>
                  <ul className={styles.guardianList}>
                    {player.guardians.map((guardian) => (
                      <li key={guardian.id}>
                        <span>{guardian.label}</span>
                        {guardian.active ? (
                          <span className={styles.active}>Linked</span>
                        ) : (
                          <span className={styles.inactive}>Unlinked</span>
                        )}
                        {guardian.active ? (
                          <form
                            action={unlinkGuardian}
                            className={styles.compactForm}
                          >
                            <input
                              type="hidden"
                              name="playerId"
                              value={player.id}
                            />
                            <input
                              type="hidden"
                              name="guardianUserId"
                              value={guardian.guardianUserId}
                            />
                            <button
                              type="submit"
                              className="stable-button stable-button--secondary"
                            >
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
                  {createInvitation !== undefined &&
                  revokeInvitation !== undefined &&
                  clubId !== null ? (
                    <InvitationPanel
                      invitations={invitations.filter(
                        (invitation) => invitation.playerId === player.id,
                      )}
                      hidden={{
                        clubId,
                        playerId: player.id,
                        returnTo: "/players",
                      }}
                      includeRole={false}
                      createInvitation={createInvitation}
                      revokeInvitation={revokeInvitation}
                    />
                  ) : null}
                </section>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {clubId === null ? null : (
        <section className={styles.addSection} aria-label="Player setup">
          <header className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Roster setup</p>
              <h2>Add or import players</h2>
            </div>
            <p>Use an individual entry or import a prepared club roster.</p>
          </header>
          <div className={styles.setupGrid}>
            <section className={styles.setupCard} aria-label="Add player">
              <form action={createPlayer} className={styles.createForm}>
                <h3>Add a player</h3>
                <input type="hidden" name="clubId" value={clubId} />
                <label htmlFor="new-given-name">
                  Given name
                  <input
                    id="new-given-name"
                    name="firstName"
                    required
                    maxLength={80}
                  />
                </label>
                <label htmlFor="new-surname">
                  Surname
                  <input
                    id="new-surname"
                    name="lastName"
                    required
                    maxLength={80}
                  />
                </label>
                <button
                  type="submit"
                  className="stable-button stable-button--primary"
                >
                  Add player
                </button>
              </form>
            </section>
            <section className={styles.setupCard} aria-label="Import players">
              <h3>Import a roster</h3>
              <PlayerImportForm clubId={clubId} action={importPlayers} />
            </section>
          </div>
        </section>
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
  const first = adults[0];
  if (first === undefined) {
    return <p>No club adults are available to link.</p>;
  }

  return (
    <form action={action} className={styles.inlineForm}>
      <input type="hidden" name="playerId" value={playerId} />
      <label htmlFor={`adult-${playerId}`}>
        Club adult
        <select
          id={`adult-${playerId}`}
          name="guardianUserId"
          defaultValue={first.userId}
        >
          {adults.map((adult) => (
            <option key={adult.userId} value={adult.userId}>
              {adult.displayName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="stable-button stable-button--primary">
        Link guardian
      </button>
    </form>
  );
}
