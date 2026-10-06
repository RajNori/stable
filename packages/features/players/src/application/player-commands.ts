import {
  ApplicationError,
  PLAYER_IMPORT_MAX_ROWS,
  playerImportRowSchema,
  playerNameSchema,
  type GuardianLink,
  type MembershipFact,
  type Player,
  type PlayerImportResult,
  type PlayerImportRow,
  type Principal,
} from "@stable/contracts";

export const playerMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "Player changes require an active club admin.",
  notFound: "Player record was not found.",
  validationFailed: "Player details failed validation.",
  importValidationFailed: "Player import failed validation.",
  inactivePlayer: "Inactive players cannot be linked.",
  saveFailed: "Player changes could not be saved.",
  readFailed: "Players could not be read.",
} as const;

export class PlayerImportValidationError extends ApplicationError {
  readonly rowNumbers: readonly number[];

  constructor(rowNumbers: readonly number[]) {
    super("VALIDATION_FAILED", playerMessages.importValidationFailed);
    this.name = "PlayerImportValidationError";
    this.rowNumbers = rowNumbers;
  }
}

export type PlayerDirectory = {
  findPlayer(playerId: string): Promise<Player | null>;
};

export type CreatePlayerCommand = {
  clubId: string;
  firstName: string;
  lastName: string;
};

export type ImportPlayersCommand = {
  clubId: string;
  rows: readonly PlayerImportRow[];
};

export type UpdatePlayerIdentityCommand = {
  playerId: string;
  firstName: string;
  lastName: string;
};

export type PlayerIdCommand = {
  playerId: string;
};

export type LinkGuardianCommand = {
  playerId: string;
  guardianUserId: string;
};

export type PlayerWriter = {
  createPlayer(command: CreatePlayerCommand): Promise<Player>;
  importPlayers(
    command: ImportPlayersCommand,
  ): Promise<readonly PlayerImportResult[]>;
  updatePlayerIdentity(command: UpdatePlayerIdentityCommand): Promise<Player>;
  deactivatePlayer(command: PlayerIdCommand): Promise<Player>;
  reactivatePlayer(command: PlayerIdCommand): Promise<Player>;
  linkGuardian(command: LinkGuardianCommand): Promise<GuardianLink>;
  unlinkGuardian(command: LinkGuardianCommand): Promise<GuardianLink>;
};

type AuthorizedCommand = {
  principal: Principal | null;
  memberships: readonly MembershipFact[];
};

export function inspectImportRows(rows: readonly unknown[]): {
  rows: PlayerImportRow[];
  rowNumbers: number[];
  valid: boolean;
} {
  if (rows.length < 1 || rows.length > PLAYER_IMPORT_MAX_ROWS) {
    return { rows: [], rowNumbers: [], valid: false };
  }

  const accepted: PlayerImportRow[] = [];
  const invalid: number[] = [];
  const seen = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const parsed = playerImportRowSchema.safeParse(rows[index]);
    const rowNumber = index + 1;
    if (!parsed.success) {
      invalid.push(rowNumber);
      continue;
    }

    const previous = seen.get(parsed.data.sourcePlayerId);
    if (previous !== undefined) {
      invalid.push(previous, rowNumber);
      continue;
    }

    seen.set(parsed.data.sourcePlayerId, rowNumber);
    accepted.push(parsed.data);
  }

  const rowNumbers = [...new Set(invalid)].sort((left, right) => left - right);
  return {
    rows: rowNumbers.length === 0 ? accepted : [],
    rowNumbers,
    valid: rowNumbers.length === 0,
  };
}

function assertClubAdmin(input: AuthorizedCommand, clubId: string): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      playerMessages.unauthenticated,
    );
  }

  const allowed = input.memberships.some(
    (membership) =>
      membership.active &&
      membership.clubId === clubId &&
      membership.role === "CLUB_ADMIN",
  );
  if (!allowed) {
    throw new ApplicationError("FORBIDDEN", playerMessages.forbidden);
  }
}

function parseName(value: string): string {
  const parsed = playerNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      playerMessages.validationFailed,
    );
  }
  return parsed.data;
}

async function save<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new ApplicationError("INTERNAL", playerMessages.saveFailed);
  }
}

async function requirePlayer(
  input: AuthorizedCommand & {
    playerId: string;
    directory: PlayerDirectory;
  },
): Promise<Player> {
  const player = await input.directory.findPlayer(input.playerId);
  if (player === null) {
    throw new ApplicationError("NOT_FOUND", playerMessages.notFound);
  }
  assertClubAdmin(input, player.clubId);
  return player;
}

export async function createPlayer(
  input: AuthorizedCommand & {
    clubId: string;
    firstName: string;
    lastName: string;
    writer: PlayerWriter;
  },
): Promise<Player> {
  assertClubAdmin(input, input.clubId);
  const firstName = parseName(input.firstName);
  const lastName = parseName(input.lastName);
  return save(() =>
    input.writer.createPlayer({
      clubId: input.clubId,
      firstName,
      lastName,
    }),
  );
}

export async function importPlayers(
  input: AuthorizedCommand & {
    clubId: string;
    rows: readonly unknown[];
    writer: PlayerWriter;
  },
): Promise<readonly PlayerImportResult[]> {
  assertClubAdmin(input, input.clubId);
  const inspected = inspectImportRows(input.rows);
  if (!inspected.valid) {
    throw new PlayerImportValidationError(inspected.rowNumbers);
  }

  return save(() =>
    input.writer.importPlayers({
      clubId: input.clubId,
      rows: inspected.rows,
    }),
  );
}

export async function updatePlayerIdentity(
  input: AuthorizedCommand & {
    playerId: string;
    firstName: string;
    lastName: string;
    directory: PlayerDirectory;
    writer: PlayerWriter;
  },
): Promise<Player> {
  await requirePlayer(input);
  const firstName = parseName(input.firstName);
  const lastName = parseName(input.lastName);
  return save(() =>
    input.writer.updatePlayerIdentity({
      playerId: input.playerId,
      firstName,
      lastName,
    }),
  );
}

export async function deactivatePlayer(
  input: AuthorizedCommand & {
    playerId: string;
    directory: PlayerDirectory;
    writer: PlayerWriter;
  },
): Promise<Player> {
  await requirePlayer(input);
  return save(() =>
    input.writer.deactivatePlayer({ playerId: input.playerId }),
  );
}

export async function reactivatePlayer(
  input: AuthorizedCommand & {
    playerId: string;
    directory: PlayerDirectory;
    writer: PlayerWriter;
  },
): Promise<Player> {
  await requirePlayer(input);
  return save(() =>
    input.writer.reactivatePlayer({ playerId: input.playerId }),
  );
}

export async function linkGuardian(
  input: AuthorizedCommand & {
    playerId: string;
    guardianUserId: string;
    directory: PlayerDirectory;
    writer: PlayerWriter;
  },
): Promise<GuardianLink> {
  const player = await requirePlayer(input);
  if (!player.active) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      playerMessages.inactivePlayer,
    );
  }
  const guardianUserId = parseUuid(input.guardianUserId);
  return save(() =>
    input.writer.linkGuardian({
      playerId: input.playerId,
      guardianUserId,
    }),
  );
}

export async function unlinkGuardian(
  input: AuthorizedCommand & {
    playerId: string;
    guardianUserId: string;
    directory: PlayerDirectory;
    writer: PlayerWriter;
  },
): Promise<GuardianLink> {
  await requirePlayer(input);
  const guardianUserId = parseUuid(input.guardianUserId);
  return save(() =>
    input.writer.unlinkGuardian({
      playerId: input.playerId,
      guardianUserId,
    }),
  );
}

function parseUuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      playerMessages.validationFailed,
    );
  }
  return value;
}
