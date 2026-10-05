import {
  ApplicationError,
  clubStructureNameSchema,
  type Competition,
  type MembershipFact,
  type Principal,
  type Season,
  type Team,
  type Venue,
} from "@stable/contracts";

export const clubStructureMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "Club structure changes require an active club admin.",
  validationFailed: "Club structure failed validation.",
  seasonClub: "The season is not in this club.",
  competitionClub: "The competition is not in this club.",
  venueClub: "The venue is not in this club.",
  notFound: "Club structure record was not found.",
  saveFailed: "Club structure could not be saved.",
  readFailed: "Club structure could not be read.",
} as const;

export type ClubStructureDirectory = {
  findSeason(seasonId: string): Promise<{ id: string; clubId: string } | null>;
  findCompetition(
    competitionId: string,
  ): Promise<{ id: string; clubId: string; seasonId: string } | null>;
  findVenue(venueId: string): Promise<{ id: string; clubId: string } | null>;
  findTeam(teamId: string): Promise<Team | null>;
};

export type CreateSeasonCommand = {
  action: "season.created";
  actorUserId: string;
  clubId: string;
  name: string;
};

export type UpdateSeasonCommand = {
  action: "season.updated";
  actorUserId: string;
  clubId: string;
  seasonId: string;
  name: string;
  active: boolean;
};

export type CreateCompetitionCommand = {
  action: "competition.created";
  actorUserId: string;
  clubId: string;
  seasonId: string;
  name: string;
};

export type UpdateCompetitionCommand = {
  action: "competition.updated";
  actorUserId: string;
  clubId: string;
  competitionId: string;
  name: string;
  active: boolean;
};

export type CreateVenueCommand = {
  action: "venue.created";
  actorUserId: string;
  clubId: string;
  name: string;
};

export type UpdateVenueCommand = {
  action: "venue.updated";
  actorUserId: string;
  clubId: string;
  venueId: string;
  name: string;
  active: boolean;
};

export type CreateTeamCommand = {
  action: "team.created";
  actorUserId: string;
  clubId: string;
  seasonId: string;
  competitionId: string | null;
  venueId: string | null;
  name: string;
};

export type UpdateTeamCommand = {
  action: "team.updated";
  actorUserId: string;
  clubId: string;
  teamId: string;
  name: string;
  active: boolean;
};

export type CreateSeasonAndTeamCommand = {
  actorUserId: string;
  clubId: string;
  seasonName: string;
  teamName: string;
};

export type ClubStructureWriter = {
  createSeason(command: CreateSeasonCommand): Promise<Season>;
  updateSeason(command: UpdateSeasonCommand): Promise<Season>;
  createCompetition(command: CreateCompetitionCommand): Promise<Competition>;
  updateCompetition(command: UpdateCompetitionCommand): Promise<Competition>;
  createVenue(command: CreateVenueCommand): Promise<Venue>;
  updateVenue(command: UpdateVenueCommand): Promise<Venue>;
  createTeam(command: CreateTeamCommand): Promise<Team>;
  updateTeam(command: UpdateTeamCommand): Promise<Team>;
  createSeasonAndTeam(
    command: CreateSeasonAndTeamCommand,
  ): Promise<{ season: Season; team: Team }>;
};

type AuthorizedCommand = {
  principal: Principal | null;
  memberships: readonly MembershipFact[];
};

function assertClubAdmin(input: AuthorizedCommand, clubId: string): Principal {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      clubStructureMessages.unauthenticated,
    );
  }

  const allowed = input.memberships.some(
    (membership) =>
      membership.active &&
      membership.clubId === clubId &&
      membership.role === "CLUB_ADMIN",
  );
  if (!allowed) {
    throw new ApplicationError("FORBIDDEN", clubStructureMessages.forbidden);
  }

  return input.principal;
}

function parseName(name: string): string {
  const parsed = clubStructureNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      clubStructureMessages.validationFailed,
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
    throw new ApplicationError("INTERNAL", clubStructureMessages.saveFailed);
  }
}

async function requireSeason(
  directory: ClubStructureDirectory,
  seasonId: string,
  clubId: string,
): Promise<void> {
  const season = await directory.findSeason(seasonId);
  if (season === null || season.clubId !== clubId) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      clubStructureMessages.seasonClub,
    );
  }
}

export async function createSeason(
  input: AuthorizedCommand & {
    clubId: string;
    name: string;
    writer: ClubStructureWriter;
  },
): Promise<Season> {
  const principal = assertClubAdmin(input, input.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.createSeason({
      action: "season.created",
      actorUserId: principal.userId,
      clubId: input.clubId,
      name,
    }),
  );
}

export async function updateSeason(
  input: AuthorizedCommand & {
    seasonId: string;
    name: string;
    active: boolean;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Season> {
  const existing = await input.directory.findSeason(input.seasonId);
  if (existing === null) {
    throw new ApplicationError("NOT_FOUND", clubStructureMessages.notFound);
  }
  const principal = assertClubAdmin(input, existing.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.updateSeason({
      action: "season.updated",
      actorUserId: principal.userId,
      clubId: existing.clubId,
      seasonId: input.seasonId,
      name,
      active: input.active,
    }),
  );
}

export async function createCompetition(
  input: AuthorizedCommand & {
    clubId: string;
    seasonId: string;
    name: string;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Competition> {
  const principal = assertClubAdmin(input, input.clubId);
  const name = parseName(input.name);
  await requireSeason(input.directory, input.seasonId, input.clubId);
  return save(() =>
    input.writer.createCompetition({
      action: "competition.created",
      actorUserId: principal.userId,
      clubId: input.clubId,
      seasonId: input.seasonId,
      name,
    }),
  );
}

export async function updateCompetition(
  input: AuthorizedCommand & {
    competitionId: string;
    name: string;
    active: boolean;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Competition> {
  const existing = await input.directory.findCompetition(input.competitionId);
  if (existing === null) {
    throw new ApplicationError("NOT_FOUND", clubStructureMessages.notFound);
  }
  const principal = assertClubAdmin(input, existing.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.updateCompetition({
      action: "competition.updated",
      actorUserId: principal.userId,
      clubId: existing.clubId,
      competitionId: input.competitionId,
      name,
      active: input.active,
    }),
  );
}

export async function createVenue(
  input: AuthorizedCommand & {
    clubId: string;
    name: string;
    writer: ClubStructureWriter;
  },
): Promise<Venue> {
  const principal = assertClubAdmin(input, input.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.createVenue({
      action: "venue.created",
      actorUserId: principal.userId,
      clubId: input.clubId,
      name,
    }),
  );
}

export async function updateVenue(
  input: AuthorizedCommand & {
    venueId: string;
    name: string;
    active: boolean;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Venue> {
  const existing = await input.directory.findVenue(input.venueId);
  if (existing === null) {
    throw new ApplicationError("NOT_FOUND", clubStructureMessages.notFound);
  }
  const principal = assertClubAdmin(input, existing.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.updateVenue({
      action: "venue.updated",
      actorUserId: principal.userId,
      clubId: existing.clubId,
      venueId: input.venueId,
      name,
      active: input.active,
    }),
  );
}

export async function createTeam(
  input: AuthorizedCommand & {
    clubId: string;
    seasonId: string;
    competitionId: string | null;
    venueId: string | null;
    name: string;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Team> {
  const principal = assertClubAdmin(input, input.clubId);
  const name = parseName(input.name);
  await requireSeason(input.directory, input.seasonId, input.clubId);
  if (input.competitionId !== null) {
    const competition = await input.directory.findCompetition(
      input.competitionId,
    );
    if (
      competition === null ||
      competition.clubId !== input.clubId ||
      competition.seasonId !== input.seasonId
    ) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        clubStructureMessages.competitionClub,
      );
    }
  }
  if (input.venueId !== null) {
    const venue = await input.directory.findVenue(input.venueId);
    if (venue === null || venue.clubId !== input.clubId) {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        clubStructureMessages.venueClub,
      );
    }
  }
  return save(() =>
    input.writer.createTeam({
      action: "team.created",
      actorUserId: principal.userId,
      clubId: input.clubId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      venueId: input.venueId,
      name,
    }),
  );
}

export async function updateTeam(
  input: AuthorizedCommand & {
    teamId: string;
    name: string;
    active: boolean;
    directory: ClubStructureDirectory;
    writer: ClubStructureWriter;
  },
): Promise<Team> {
  const existing = await input.directory.findTeam(input.teamId);
  if (existing === null) {
    throw new ApplicationError("NOT_FOUND", clubStructureMessages.notFound);
  }
  const principal = assertClubAdmin(input, existing.clubId);
  const name = parseName(input.name);
  return save(() =>
    input.writer.updateTeam({
      action: "team.updated",
      actorUserId: principal.userId,
      clubId: existing.clubId,
      teamId: input.teamId,
      name,
      active: input.active,
    }),
  );
}

export async function createSeasonAndTeam(
  input: AuthorizedCommand & {
    clubId: string;
    seasonName: string;
    teamName: string;
    writer: ClubStructureWriter;
  },
): Promise<{ season: Season; team: Team }> {
  const principal = assertClubAdmin(input, input.clubId);
  const seasonName = parseName(input.seasonName);
  const teamName = parseName(input.teamName);
  return save(() =>
    input.writer.createSeasonAndTeam({
      actorUserId: principal.userId,
      clubId: input.clubId,
      seasonName,
      teamName,
    }),
  );
}
