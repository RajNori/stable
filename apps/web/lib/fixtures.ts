import type {
  ClubContextReader,
  ClubMembershipRecord,
  GetCurrentClubContextInput,
  Principal,
} from "@stable/contracts";

const MEMBER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OUTSIDER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLUB_ID = "11111111-1111-4111-8111-111111111111";

export const CONTEXT_FIXTURES = [
  "member",
  "outsider",
  "unauthenticated",
  "error",
  "loading",
] as const;

export type ContextFixtureName = (typeof CONTEXT_FIXTURES)[number];

export type ResolvedContextFixture = Exclude<ContextFixtureName, "loading">;

export type FixtureModeEnv = {
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
};

const memberClub: ClubMembershipRecord["club"] = {
  id: CLUB_ID,
  name: "Mentone Mustangs",
  slug: "mentone-mustangs",
  timezone: "Australia/Melbourne",
  themeKey: "mustangs",
};

export function isContextFixtureMode(
  env: FixtureModeEnv = process.env,
): boolean {
  if (env.NEXT_PUBLIC_APP_ENV === "production") {
    return false;
  }

  return env.NODE_ENV === "test";
}

export function contextFixtureFromQuery(
  value: string | string[] | undefined,
  env: FixtureModeEnv = process.env,
): ContextFixtureName | null {
  if (!isContextFixtureMode(env)) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return null;
  }

  if (
    raw === "member" ||
    raw === "outsider" ||
    raw === "unauthenticated" ||
    raw === "error" ||
    raw === "loading"
  ) {
    return raw;
  }

  return null;
}

function reader(read: ClubContextReader["read"]): ClubContextReader {
  return { read };
}

export function fixtureClubContextInput(
  fixture: ResolvedContextFixture,
): GetCurrentClubContextInput {
  if (fixture === "unauthenticated") {
    return {
      principal: null,
      reader: reader(() =>
        Promise.reject(new Error("reader should not be called")),
      ),
    };
  }

  if (fixture === "error") {
    return {
      principal: memberPrincipal(),
      reader: reader(() =>
        Promise.reject(new Error("relation clubs does not exist")),
      ),
    };
  }

  if (fixture === "outsider") {
    return {
      principal: outsiderPrincipal(),
      reader: reader(() =>
        Promise.resolve({
          displayName: "Sam Outsider",
          memberships: [],
        }),
      ),
    };
  }

  return {
    principal: memberPrincipal(),
    reader: reader(() =>
      Promise.resolve({
        displayName: "Jordan P",
        memberships: [memberMembership()],
      }),
    ),
  };
}

function memberPrincipal(): Principal {
  return {
    userId: MEMBER_USER_ID,
    displayName: "Jordan P",
  };
}

function outsiderPrincipal(): Principal {
  return {
    userId: OUTSIDER_USER_ID,
    displayName: "Sam Outsider",
  };
}

function memberMembership(): ClubMembershipRecord {
  return {
    clubId: CLUB_ID,
    role: "CLUB_ADMIN",
    active: true,
    club: memberClub,
  };
}
