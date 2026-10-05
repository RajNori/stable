import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@stable/database-types";
import { describe, expect, it } from "vitest";

import { createSupabaseClubContextReader } from "../index.js";

const READ_FAILURE_MESSAGE = "Club context could not be read.";
const userId = "22222222-2222-4222-8222-222222222222";
const clubId = "11111111-1111-4111-8111-111111111111";
const driverMessage =
  "JWT expired: duplicate key value violates unique constraint (Postgres)";

const membershipColumns =
  "club_id, role, active, clubs(id, name, slug, timezone, theme_key)";

type QueryError = {
  message: string;
  details: string;
  hint: string;
  code: string;
};

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type AuthUser = {
  id: string;
  user_metadata: unknown;
};

type AuthResult = {
  data: { user: AuthUser | null };
  error: { message: string } | null;
};

type RecordedQuery = {
  table: string;
  columns: string;
  filters: Array<{ column: string; value: string | boolean }>;
  maybeSingle: boolean;
};

type FakeClient = {
  recorded: RecordedQuery[];
  getUserCalls: number;
  client: SupabaseClient<Database>;
};

function driverError(message: string): QueryError {
  return {
    message,
    details: message,
    hint: message,
    code: "PGRST301",
  };
}

function createFakeClient(input: {
  memberships: QueryResult;
  profile: QueryResult;
  auth?: AuthResult;
}): FakeClient {
  const recorded: RecordedQuery[] = [];
  let getUserCalls = 0;
  const authResult: AuthResult = input.auth ?? {
    data: { user: null },
    error: null,
  };

  const fake = {
    from(table: string) {
      const result = table === "profiles" ? input.profile : input.memberships;
      return {
        select(columns: string) {
          const query: RecordedQuery = {
            table,
            columns,
            filters: [],
            maybeSingle: false,
          };
          recorded.push(query);

          const builder = {
            eq(column: string, value: string | boolean) {
              query.filters.push({ column, value });
              return builder;
            },
            maybeSingle() {
              query.maybeSingle = true;
              return Promise.resolve(result);
            },
            then<TResult1 = QueryResult, TResult2 = never>(
              onfulfilled?:
                | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
                | null,
              onrejected?:
                ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ): Promise<TResult1 | TResult2> {
              return Promise.resolve(result).then(onfulfilled, onrejected);
            },
          };

          return builder;
        },
      };
    },
    auth: {
      getUser() {
        getUserCalls += 1;
        return Promise.resolve(authResult);
      },
    },
  };

  return {
    recorded,
    get getUserCalls() {
      return getUserCalls;
    },
    client: fake as unknown as SupabaseClient<Database>,
  };
}

function expectCallerQueries(recorded: RecordedQuery[]): void {
  expect(recorded).toEqual([
    {
      table: "club_memberships",
      columns: membershipColumns,
      filters: [
        { column: "user_id", value: userId },
        { column: "active", value: true },
      ],
      maybeSingle: false,
    },
    {
      table: "profiles",
      columns: "display_name",
      filters: [{ column: "user_id", value: userId }],
      maybeSingle: true,
    },
  ]);
}

async function captureReadError(
  client: SupabaseClient<Database>,
): Promise<Error> {
  try {
    await createSupabaseClubContextReader(client).read(userId);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw new Error("Expected Error.", { cause: error });
    }
    return error;
  }

  throw new Error("Expected the reader to throw.");
}

function expectRedacted(error: Error): void {
  expect(error.message).toBe(READ_FAILURE_MESSAGE);
  expect(error.message).not.toContain("JWT");
  expect(error.message).not.toContain("duplicate key");
  expect(error.message).not.toContain("Postgres");
  expect(error.message).not.toContain("PGRST");
  expect(error.cause).toBeUndefined();
}

const memberRow = {
  club_id: clubId,
  role: "CLUB_ADMIN",
  active: true,
  clubs: {
    id: clubId,
    name: "Mentone Mustangs",
    slug: "mentone-mustangs",
    timezone: "Australia/Melbourne",
    theme_key: "mustangs",
  },
};

describe("createSupabaseClubContextReader", () => {
  it("maps the caller's active membership and profile display name", async () => {
    const fake = createFakeClient({
      memberships: { data: [memberRow], error: null },
      profile: { data: { display_name: "Local Member" }, error: null },
    });

    const result = await createSupabaseClubContextReader(fake.client).read(
      userId,
    );

    expectCallerQueries(fake.recorded);
    expect(fake.getUserCalls).toBe(0);
    expect(result).toEqual({
      displayName: "Local Member",
      memberships: [
        {
          clubId,
          role: "CLUB_ADMIN",
          active: true,
          club: {
            id: clubId,
            name: "Mentone Mustangs",
            slug: "mentone-mustangs",
            timezone: "Australia/Melbourne",
            themeKey: "mustangs",
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("theme_key");
    expect(JSON.stringify(result)).not.toContain("display_name");
  });

  it("uses auth metadata when RLS returns no membership or profile", async () => {
    const fake = createFakeClient({
      memberships: { data: [], error: null },
      profile: { data: null, error: null },
      auth: {
        data: {
          user: {
            id: userId,
            user_metadata: { display_name: "Outsider O" },
          },
        },
        error: null,
      },
    });

    const result = await createSupabaseClubContextReader(fake.client).read(
      userId,
    );

    expectCallerQueries(fake.recorded);
    expect(fake.getUserCalls).toBe(1);
    expect(result).toEqual({
      displayName: "Outsider O",
      memberships: [],
    });
  });

  it.each([
    { label: "missing", metadata: {} },
    { label: "empty", metadata: { display_name: "" } },
    { label: "not a string", metadata: { display_name: 4 } },
    { label: "null metadata", metadata: null },
  ])(
    "falls back to Signed in when metadata display name is $label",
    async ({ metadata }) => {
      const fake = createFakeClient({
        memberships: { data: [], error: null },
        profile: { data: null, error: null },
        auth: {
          data: { user: { id: userId, user_metadata: metadata } },
          error: null,
        },
      });

      const result = await createSupabaseClubContextReader(fake.client).read(
        userId,
      );

      expect(result).toEqual({
        displayName: "Signed in",
        memberships: [],
      });
    },
  );

  it("redacts membership PostgREST errors", async () => {
    const fake = createFakeClient({
      memberships: { data: null, error: driverError(driverMessage) },
      profile: { data: { display_name: "Local Member" }, error: null },
    });

    expectRedacted(await captureReadError(fake.client));
    expect(fake.getUserCalls).toBe(0);
    expect(fake.recorded).toEqual([
      expect.objectContaining({ table: "club_memberships" }),
    ]);
  });

  it("redacts profile PostgREST errors", async () => {
    const fake = createFakeClient({
      memberships: { data: [], error: null },
      profile: { data: null, error: driverError(driverMessage) },
    });

    expectRedacted(await captureReadError(fake.client));
    expect(fake.getUserCalls).toBe(0);
  });

  it("redacts auth errors when the outsider display name cannot be read", async () => {
    const fake = createFakeClient({
      memberships: { data: [], error: null },
      profile: { data: null, error: null },
      auth: {
        data: { user: null },
        error: { message: driverMessage },
      },
    });

    expectRedacted(await captureReadError(fake.client));
  });

  it("redacts a missing auth user for the outsider fallback", async () => {
    const fake = createFakeClient({
      memberships: { data: [], error: null },
      profile: { data: null, error: null },
      auth: { data: { user: null }, error: null },
    });

    expectRedacted(await captureReadError(fake.client));
  });

  it("redacts a membership payload that is not a row list", async () => {
    const fake = createFakeClient({
      memberships: { data: null, error: null },
      profile: { data: null, error: null },
    });

    expectRedacted(await captureReadError(fake.client));
    expect(fake.getUserCalls).toBe(0);
  });

  it("redacts a membership row that does not embed a club", async () => {
    const fake = createFakeClient({
      memberships: {
        data: [{ club_id: clubId, role: "COACH", active: true, clubs: null }],
        error: null,
      },
      profile: { data: { display_name: "Local Member" }, error: null },
    });

    const error = await captureReadError(fake.client);
    expectRedacted(error);
    expect(error.message).not.toContain("COACH");
    expect(error.message).not.toContain("Invalid");
  });

  it.each([
    { label: "missing", data: null },
    { label: "blank", data: { display_name: "" } },
    { label: "not a string", data: { display_name: 4 } },
  ])(
    "redacts a membership whose profile display name is $label",
    async ({ data }) => {
      const fake = createFakeClient({
        memberships: { data: [memberRow], error: null },
        profile: { data, error: null },
      });

      expectRedacted(await captureReadError(fake.client));
      expect(fake.getUserCalls).toBe(0);
    },
  );
});
