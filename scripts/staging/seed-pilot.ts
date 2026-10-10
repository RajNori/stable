/**
 * Idempotently creates synthetic M5B role-journey data in the one approved
 * Supabase staging project. Auth identities are created through Auth Admin;
 * there is deliberately no SQL path to auth.users.
 *
 * Required: APP_ENV=staging TARGET_PROJECT_REF=<approved ref>
 *           SUPABASE_URL=<approved URL>
 * Run:      node --experimental-strip-types scripts/staging/seed-pilot.ts --confirm-staging
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  assertStagingSeedTarget,
  classifySeedRow,
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_URL,
} from "./seed-guard.ts";

const CLUB = "11111111-1111-4111-8111-111111111111";
const SEASON = "88888888-8888-4888-8888-888888888888";
const PRIMARY_TEAM = "99999999-9999-4999-8999-999999999999";
const SECOND_TEAM = "99999999-9999-4999-8999-999999999998";
const VENUE = "aaaaaaaa-1111-4111-8111-111111111111";
const COMPETITION = "aaaaaaaa-2222-4222-8222-222222222222";
const EVENT = {
  completed: "bbbbbbbb-0001-4000-8000-000000000001",
  upcoming: "bbbbbbbb-0001-4000-8000-000000000002",
  future: "bbbbbbbb-0001-4000-8000-000000000003",
  cancelled: "bbbbbbbb-0001-4000-8000-000000000004",
  training: "bbbbbbbb-0001-4000-8000-000000000005",
  secondTeam: "bbbbbbbb-0001-4000-8000-000000000006",
} as const;
const PLAN = "bbbbbbbb-0002-4000-8000-000000000001";
const ANNOUNCEMENT = "bbbbbbbb-0003-4000-8000-000000000001";
const DUTY = "bbbbbbbb-0004-4000-8000-000000000001";
const ASSIGNMENT = "bbbbbbbb-0005-4000-8000-000000000001";
const SWAP = "bbbbbbbb-0006-4000-8000-000000000001";
const FILL_IN = "bbbbbbbb-0007-4000-8000-000000000001";

const USER = {
  adminCoach: "c0000000-0000-4000-8000-000000000001",
  assistant: "c0000000-0000-4000-8000-000000000002",
  manager: "c0000000-0000-4000-8000-000000000003",
  guardianOne: "c0000000-0000-4000-8000-000000000004",
  guardianTwo: "c0000000-0000-4000-8000-000000000005",
  guardianThree: "c0000000-0000-4000-8000-000000000006",
  adminOnly: "c0000000-0000-4000-8000-000000000007",
  otherTeamCoach: "c0000000-0000-4000-8000-000000000008",
} as const;
const PLAYER_IDS = Array.from(
  { length: 8 },
  (_, index) =>
    `d0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

type Json = Record<string, unknown>;
type SeedUser = Readonly<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}>;

const USERS: readonly SeedUser[] = [
  {
    id: USER.adminCoach,
    email: "m5b-admin-coach@stable.invalid",
    firstName: "Casey",
    lastName: "Sample",
  },
  {
    id: USER.assistant,
    email: "m5b-assistant-coach@stable.invalid",
    firstName: "Jordan",
    lastName: "Sample",
  },
  {
    id: USER.manager,
    email: "m5b-team-manager@stable.invalid",
    firstName: "Morgan",
    lastName: "Sample",
  },
  {
    id: USER.guardianOne,
    email: "m5b-guardian-one@stable.invalid",
    firstName: "Taylor",
    lastName: "Sample",
  },
  {
    id: USER.guardianTwo,
    email: "m5b-guardian-two@stable.invalid",
    firstName: "Riley",
    lastName: "Sample",
  },
  {
    id: USER.guardianThree,
    email: "m5b-guardian-three@stable.invalid",
    firstName: "Alex",
    lastName: "Sample",
  },
  {
    id: USER.adminOnly,
    email: "m5b-admin-only@stable.invalid",
    firstName: "Sam",
    lastName: "Sample",
  },
  {
    id: USER.otherTeamCoach,
    email: "m5b-other-team-coach@stable.invalid",
    firstName: "Jamie",
    lastName: "Sample",
  },
];

function readApiKeys(): { serviceKey: string; publicKey: string } {
  let output: string;
  try {
    output = execFileSync(
      "node_modules/.bin/supabase",
      [
        "projects",
        "api-keys",
        "--project-ref",
        STAGING_PROJECT_REF,
        "--reveal",
        "--output",
        "json",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    // Do not stringify child-process errors; they may contain CLI output.
    throw new Error("Unable to resolve the approved staging API key.");
  }
  const parsed: unknown = JSON.parse(output);
  const keys = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.api_keys)
      ? parsed.api_keys
      : isRecord(parsed) && Array.isArray(parsed.keys)
        ? parsed.keys
        : [];
  const serviceKey = keys.find(
    (entry) =>
      isRecord(entry) &&
      entry.name === "service_role" &&
      typeof entry.api_key === "string",
  );
  if (!isRecord(serviceKey) || typeof serviceKey.api_key !== "string") {
    throw new Error("Supabase CLI did not return a staging service key.");
  }
  const publicKey = keys.find(
    (entry) =>
      isRecord(entry) &&
      entry.name === "anon" &&
      typeof entry.api_key === "string",
  );
  if (!isRecord(publicKey) || typeof publicKey.api_key !== "string") {
    throw new Error("Supabase CLI did not return the staging public API key.");
  }
  return { serviceKey: serviceKey.api_key, publicKey: publicKey.api_key };
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}

function readLinkedRef(): string {
  const linkedRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  if (linkedRef.length === 0) {
    throw new Error("Supabase CLI project link is missing or malformed.");
  }
  return linkedRef;
}

function shiftDays(days: number, hour = 9): string {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function shiftHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

function responseError(
  path: string,
  status: number,
  code?: string,
  message?: string,
): Error {
  const safeMessage = message
    ?.replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 240);
  return new Error(
    `Staging seed request failed (${status}) at ${path}${code ? ` [${code}]` : ""}${safeMessage ? `: ${safeMessage}` : "."}`,
  );
}

async function request(
  serviceKey: string,
  path: string,
  method: string,
  body?: unknown,
  prefer?: string,
): Promise<unknown> {
  const headers = new Headers({
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    accept: "application/json",
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (prefer !== undefined) headers.set("prefer", prefer);
  const result = await fetch(`${STAGING_SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await result.text();
  if (!result.ok) {
    let code: string | undefined;
    let message: string | undefined;
    try {
      const errorBody: unknown = JSON.parse(text);
      if (isRecord(errorBody)) {
        if (typeof errorBody.code === "string") code = errorBody.code;
        if (typeof errorBody.message === "string") message = errorBody.message;
      }
    } catch {
      // Do not include an unstructured response body in diagnostic output.
    }
    throw responseError(path, result.status, code, message);
  }
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}

async function ensureAuthUser(
  serviceKey: string,
  user: SeedUser,
): Promise<void> {
  const lookup = await fetch(
    `${STAGING_SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
    {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        accept: "application/json",
      },
    },
  );
  if (lookup.ok) return;
  if (lookup.status !== 404) {
    throw responseError(`/auth/v1/admin/users/${user.id}`, lookup.status);
  }
  const created = await fetch(`${STAGING_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      email_confirm: true,
      password: randomBytes(32).toString("base64url"),
      user_metadata: {
        display_name: `${user.firstName} ${user.lastName}`,
        seed: "m5b-synthetic-v1",
      },
    }),
  });
  if (created.status !== 200 && created.status !== 201) {
    throw responseError("/auth/v1/admin/users", created.status);
  }
}

async function createSession(
  serviceKey: string,
  publicKey: string,
  email: string,
): Promise<string> {
  const generated = await fetch(
    `${STAGING_SUPABASE_URL}/auth/v1/admin/generate_link`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ type: "magiclink", email }),
    },
  );
  if (!generated.ok) {
    throw responseError("/auth/v1/admin/generate_link", generated.status);
  }
  const generatedBody: unknown = await generated.json();
  const tokenHash =
    isRecord(generatedBody) && typeof generatedBody.hashed_token === "string"
      ? generatedBody.hashed_token
      : isRecord(generatedBody) && typeof generatedBody.token_hash === "string"
        ? generatedBody.token_hash
        : undefined;
  if (tokenHash === undefined) {
    throw new Error(
      "Staging Auth Admin did not return a one-time login proof.",
    );
  }
  const verified = await fetch(`${STAGING_SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  if (!verified.ok) throw responseError("/auth/v1/verify", verified.status);
  const session: unknown = await verified.json();
  if (!isRecord(session) || typeof session.access_token !== "string") {
    throw new Error("Staging Auth did not return a user session.");
  }
  return session.access_token;
}

async function rpc(
  publicKey: string,
  accessToken: string,
  name: string,
  args: Json,
): Promise<unknown> {
  const path = `/rest/v1/rpc/${name}`;
  const result = await fetch(`${STAGING_SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await result.text();
  if (!result.ok) {
    let code: string | undefined;
    let message: string | undefined;
    try {
      const errorBody: unknown = JSON.parse(text);
      if (isRecord(errorBody)) {
        if (typeof errorBody.code === "string") code = errorBody.code;
        if (typeof errorBody.message === "string") message = errorBody.message;
      }
    } catch {
      // Keep unstructured server output out of logs.
    }
    throw responseError(path, result.status, code, message);
  }
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
}

async function upsert(
  serviceKey: string,
  table: string,
  conflict: string,
  rows: readonly Json[],
): Promise<void> {
  if (rows.length === 0) return;
  const query = new URLSearchParams({ on_conflict: conflict });
  await request(
    serviceKey,
    `/rest/v1/${table}?${query.toString()}`,
    "POST",
    rows,
    "resolution=ignore-duplicates,return=minimal",
  );
}

async function seedRowMatches(
  serviceKey: string,
  table: string,
  filters: Readonly<Record<string, string>>,
  expected: Json,
  fields: readonly string[],
): Promise<boolean> {
  const query = new URLSearchParams({ select: fields.join(","), ...filters });
  const rows = await request(
    serviceKey,
    `/rest/v1/${table}?${query.toString()}`,
    "GET",
  );
  if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
    throw new Error(`Unable to verify synthetic staging row in ${table}.`);
  }
  return classifySeedRow(rows as Json[], expected, fields) === "matching";
}

async function seed(): Promise<void> {
  assertStagingSeedTarget({
    appEnv: process.env.APP_ENV,
    projectRef: process.env.TARGET_PROJECT_REF,
    supabaseUrl: process.env.SUPABASE_URL,
    args: process.argv.slice(2),
  });
  if (readLinkedRef() !== STAGING_PROJECT_REF) {
    throw new Error("Supabase CLI is linked to an unapproved project.");
  }
  if (process.argv.slice(2).includes("--dry-run")) {
    console.log(
      `Dry run: ${USERS.length} synthetic Auth users, 8 players, 2 teams, and 6 events are planned for ${STAGING_PROJECT_REF}.`,
    );
    return;
  }

  // Resolve the secret only in memory from the authenticated CLI session. It
  // is never logged, written to disk, or placed in a client/public variable.
  const { serviceKey, publicKey } = readApiKeys();
  for (const user of USERS) await ensureAuthUser(serviceKey, user);
  const sessions = new Map<string, string>();
  const coach = USERS.find((user) => user.id === USER.adminCoach);
  if (coach === undefined) throw new Error("Coach seed identity unavailable.");
  sessions.set(
    coach.id,
    await createSession(serviceKey, publicKey, coach.email),
  );
  const coachSession = sessions.get(USER.adminCoach);
  if (coachSession === undefined) throw new Error("Coach session unavailable.");

  const now = new Date().toISOString();
  const completedStart = shiftDays(-7, 8);
  const upcomingStart = shiftDays(2, 8);
  const futureStart = shiftDays(8, 10);
  const cancelledStart = shiftDays(10, 8);
  const trainingStart = shiftDays(4, 7);
  const secondTeamStart = shiftDays(5, 8);

  const rows: ReadonlyArray<readonly [string, string, readonly Json[]]> = [
    [
      "clubs",
      "id",
      [
        {
          id: CLUB,
          name: "Mentone Mustangs",
          slug: "mentone-mustangs",
          timezone: "Australia/Melbourne",
          theme_key: "mustangs",
          active: true,
        },
      ],
    ],
    [
      "seasons",
      "id",
      [
        {
          id: SEASON,
          club_id: CLUB,
          name: "2026 Synthetic Pilot",
          active: true,
        },
      ],
    ],
    [
      "venues",
      "id",
      [
        {
          id: VENUE,
          club_id: CLUB,
          name: "Mentone Sports Centre",
          active: true,
        },
      ],
    ],
    [
      "competitions",
      "id",
      [
        {
          id: COMPETITION,
          club_id: CLUB,
          season_id: SEASON,
          name: "M5B Synthetic League",
          active: true,
        },
      ],
    ],
    [
      "teams",
      "id",
      [
        {
          id: PRIMARY_TEAM,
          club_id: CLUB,
          season_id: SEASON,
          competition_id: COMPETITION,
          venue_id: VENUE,
          name: "U14 Boys",
          active: true,
        },
        {
          id: SECOND_TEAM,
          club_id: CLUB,
          season_id: SEASON,
          competition_id: COMPETITION,
          venue_id: VENUE,
          name: "U12 Girls · Synthetic",
          active: true,
        },
      ],
    ],
    [
      "profiles",
      "user_id",
      USERS.map((user) => ({
        user_id: user.id,
        display_name: `${user.firstName} ${user.lastName}`,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone_e164: null,
        locale: "en-AU",
      })),
    ],
    [
      "club_memberships",
      "id",
      [
        {
          id: "e0000000-0000-4000-8000-000000000001",
          club_id: CLUB,
          user_id: USER.adminCoach,
          role: "CLUB_ADMIN",
          active: true,
        },
        {
          id: "e0000000-0000-4000-8000-000000000006",
          club_id: CLUB,
          user_id: USER.adminOnly,
          role: "CLUB_ADMIN",
          active: true,
        },
      ],
    ],
    [
      "team_memberships",
      "id",
      [
        {
          id: "e0000000-0000-4000-8000-000000000002",
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          user_id: USER.adminCoach,
          role: "HEAD_COACH",
          active: true,
        },
        {
          id: "e0000000-0000-4000-8000-000000000003",
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          user_id: USER.assistant,
          role: "ASSISTANT_COACH",
          active: true,
        },
        {
          id: "e0000000-0000-4000-8000-000000000004",
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          user_id: USER.manager,
          role: "TEAM_MANAGER",
          active: true,
        },
        {
          id: "e0000000-0000-4000-8000-000000000005",
          club_id: CLUB,
          team_id: SECOND_TEAM,
          user_id: USER.assistant,
          role: "HEAD_COACH",
          active: true,
        },
        {
          id: "e0000000-0000-4000-8000-000000000007",
          club_id: CLUB,
          team_id: SECOND_TEAM,
          user_id: USER.otherTeamCoach,
          role: "ASSISTANT_COACH",
          active: true,
        },
      ],
    ],
    [
      "players",
      "id",
      PLAYER_IDS.map((id, index) => ({
        id,
        club_id: CLUB,
        first_name: [
          "Avery",
          "Bailey",
          "Charlie",
          "Dakota",
          "Emerson",
          "Finley",
          "Harper",
          "Indigo",
        ][index],
        last_name: `Sample ${String(index + 1).padStart(2, "0")}`,
        active: true,
      })),
    ],
    [
      "guardian_relationships",
      "id",
      [
        ...[0, 1, 2, 3].map((index) => ({
          id: `e1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          club_id: CLUB,
          player_id: PLAYER_IDS[index],
          user_id: index === 0 ? USER.guardianOne : USER.guardianTwo,
          active: true,
        })),
        {
          id: "e1000000-0000-4000-8000-000000000005",
          club_id: CLUB,
          player_id: PLAYER_IDS[4],
          user_id: USER.guardianThree,
          active: true,
        },
        {
          id: "e1000000-0000-4000-8000-000000000006",
          club_id: CLUB,
          player_id: PLAYER_IDS[5],
          user_id: USER.guardianThree,
          active: true,
        },
        {
          id: "e1000000-0000-4000-8000-000000000007",
          club_id: CLUB,
          player_id: PLAYER_IDS[6],
          user_id: USER.guardianOne,
          active: true,
        },
        {
          id: "e1000000-0000-4000-8000-000000000008",
          club_id: CLUB,
          player_id: PLAYER_IDS[7],
          user_id: USER.guardianThree,
          active: true,
        },
      ],
    ],
    [
      "player_team_registrations",
      "id",
      PLAYER_IDS.map((id, index) => ({
        id: `e2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        club_id: CLUB,
        team_id: index < 6 ? PRIMARY_TEAM : SECOND_TEAM,
        player_id: id,
        active: true,
      })),
    ],
    [
      "events",
      "id",
      [
        {
          id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_type: "GAME",
          starts_at: completedStart,
          ends_at: shiftHours(completedStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 1",
          status: "COMPLETED",
        },
        {
          id: EVENT.upcoming,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_type: "GAME",
          starts_at: upcomingStart,
          ends_at: shiftHours(upcomingStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 1",
          status: "SCHEDULED",
        },
        {
          id: EVENT.future,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_type: "GAME",
          starts_at: futureStart,
          ends_at: shiftHours(futureStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 2",
          status: "SCHEDULED",
        },
        {
          id: EVENT.cancelled,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_type: "GAME",
          starts_at: cancelledStart,
          ends_at: shiftHours(cancelledStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 2",
          status: "CANCELLED",
        },
        {
          id: EVENT.training,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_type: "TRAINING",
          starts_at: trainingStart,
          ends_at: shiftHours(trainingStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 1",
          status: "SCHEDULED",
        },
        {
          id: EVENT.secondTeam,
          club_id: CLUB,
          team_id: SECOND_TEAM,
          event_type: "GAME",
          starts_at: secondTeamStart,
          ends_at: shiftHours(secondTeamStart, 1.5),
          venue_id: VENUE,
          court_label: "Court 3",
          status: "SCHEDULED",
        },
      ],
    ],
    [
      "games",
      "event_id",
      [
        {
          event_id: EVENT.completed,
          club_id: CLUB,
          competition_id: COMPETITION,
          round_label: "Round 1",
          opponent_name: "Seagulls (Synthetic)",
          source: "MANUAL",
          external_id: null,
          official_start_at: completedStart,
          official_venue_text: "Mentone Sports Centre",
          official_court_label: "Court 1",
          fixture_status: "COMPLETED",
          home_away: "HOME",
          team_score: null,
          opponent_score: null,
          result_status: null,
          last_external_sync_at: null,
        },
        {
          event_id: EVENT.upcoming,
          club_id: CLUB,
          competition_id: COMPETITION,
          round_label: "Round 2",
          opponent_name: "Comets (Synthetic)",
          source: "MANUAL",
          external_id: null,
          official_start_at: upcomingStart,
          official_venue_text: "Mentone Sports Centre",
          official_court_label: "Court 1",
          fixture_status: "SCHEDULED",
          home_away: "AWAY",
          team_score: null,
          opponent_score: null,
          result_status: null,
          last_external_sync_at: null,
        },
        {
          event_id: EVENT.future,
          club_id: CLUB,
          competition_id: COMPETITION,
          round_label: "Round 3",
          opponent_name: "Falcons (Synthetic)",
          source: "MANUAL",
          external_id: null,
          official_start_at: futureStart,
          official_venue_text: "Mentone Sports Centre",
          official_court_label: "Court 2",
          fixture_status: "SCHEDULED",
          home_away: "HOME",
          team_score: null,
          opponent_score: null,
          result_status: null,
          last_external_sync_at: null,
        },
        {
          event_id: EVENT.cancelled,
          club_id: CLUB,
          competition_id: COMPETITION,
          round_label: "Round 4",
          opponent_name: "Tigers (Synthetic)",
          source: "MANUAL",
          external_id: null,
          official_start_at: cancelledStart,
          official_venue_text: "Mentone Sports Centre",
          official_court_label: "Court 2",
          fixture_status: "CANCELLED",
          home_away: "AWAY",
          team_score: null,
          opponent_score: null,
          result_status: null,
          last_external_sync_at: null,
        },
        {
          event_id: EVENT.secondTeam,
          club_id: CLUB,
          competition_id: COMPETITION,
          round_label: "Round 2",
          opponent_name: "Comets (Synthetic)",
          source: "MANUAL",
          external_id: null,
          official_start_at: secondTeamStart,
          official_venue_text: "Mentone Sports Centre",
          official_court_label: "Court 3",
          fixture_status: "SCHEDULED",
          home_away: "HOME",
          team_score: null,
          opponent_score: null,
          result_status: null,
          last_external_sync_at: null,
        },
      ],
    ],
    [
      "training_sessions",
      "event_id",
      [{ event_id: EVENT.training, lead_coach_user_id: USER.adminCoach }],
    ],
    [
      "game_team_overlay",
      "game_event_id",
      [
        {
          game_event_id: EVENT.completed,
          arrival_at: shiftHours(completedStart, -0.5),
          uniform_note: "Synthetic: dark top",
          coach_focus: "Synthetic: communicate early",
          team_note: "Staging sample only.",
        },
        {
          game_event_id: EVENT.upcoming,
          arrival_at: shiftHours(upcomingStart, -0.5),
          uniform_note: "Synthetic: light top",
          coach_focus: "Synthetic: move the ball",
          team_note: "Staging sample only.",
        },
        {
          game_event_id: EVENT.future,
          arrival_at: shiftHours(futureStart, -0.5),
          uniform_note: "Synthetic: dark top",
          coach_focus: "Synthetic: help defence",
          team_note: "Staging sample only.",
        },
        {
          game_event_id: EVENT.cancelled,
          arrival_at: shiftHours(cancelledStart, -0.5),
          uniform_note: "Synthetic: light top",
          coach_focus: null,
          team_note: "Cancelled synthetic event.",
        },
        {
          game_event_id: EVENT.secondTeam,
          arrival_at: shiftHours(secondTeamStart, -0.5),
          uniform_note: "Synthetic: dark top",
          coach_focus: "Synthetic: share opportunities",
          team_note: "Staging sample only.",
        },
      ],
    ],
    [
      "attendance_responses",
      "id",
      [
        ...([
          "ATTENDING",
          "ATTENDING",
          "ATTENDING",
          "UNAVAILABLE",
          "UNAVAILABLE",
          "UNSURE",
        ].map((status, index) => ({
          id: `e3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_id: EVENT.upcoming,
          player_id: PLAYER_IDS[index],
          status,
          absence_category: status === "UNAVAILABLE" ? "FAMILY" : null,
          private_note: null,
          responded_by_user_id:
            index === 0 ? USER.guardianOne : USER.guardianTwo,
        })) as Json[]),
      ],
    ],
    [
      "duties",
      "id",
      [
        {
          id: DUTY,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_id: EVENT.upcoming,
          duty_type: "SCORER",
          label: "Scorebench · Synthetic",
        },
      ],
    ],
    [
      "duty_assignments",
      "id",
      [
        {
          id: ASSIGNMENT,
          duty_id: DUTY,
          assigned_user_id: USER.guardianOne,
          status: "ASSIGNED",
          assigned_by: USER.adminCoach,
          acknowledged_at: now,
        },
      ],
    ],
    [
      "duty_swap_requests",
      "id",
      [
        {
          id: SWAP,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          assignment_id: ASSIGNMENT,
          requester_user_id: USER.guardianOne,
          target_user_id: USER.guardianTwo,
          status: "OPEN",
        },
      ],
    ],
    [
      "fill_in_requests",
      "id",
      [
        {
          id: FILL_IN,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          event_id: EVENT.future,
          requested_by: USER.adminCoach,
          status: "OPEN",
        },
      ],
    ],
    [
      "fill_in_responses",
      "id",
      [
        {
          id: "e4000000-0000-4000-8000-000000000001",
          request_id: FILL_IN,
          player_id: PLAYER_IDS[1],
          guardian_user_id: USER.guardianTwo,
        },
      ],
    ],
    [
      "announcements",
      "id",
      [
        {
          id: ANNOUNCEMENT,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          author_user_id: USER.adminCoach,
          category: "GENERAL",
          importance: "IMPORTANT",
          title: "Welcome to the synthetic pilot",
          body: "All names and fixtures in this staging example are fictional.",
          acknowledgement_required: true,
          published_at: now,
        },
      ],
    ],
    [
      "announcement_acknowledgements",
      "announcement_id,user_id",
      [{ announcement_id: ANNOUNCEMENT, user_id: USER.guardianOne }],
    ],
    [
      "game_player_stats",
      "game_event_id,player_id",
      [
        {
          game_event_id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          player_id: PLAYER_IDS[0],
          points: 12,
          rebounds: 5,
          assists: 3,
          steals: 2,
          fouls: 1,
          approximate_minutes: 28,
          recorded_by: USER.adminCoach,
          updated_by: USER.adminCoach,
        },
        {
          game_event_id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          player_id: PLAYER_IDS[1],
          points: 8,
          rebounds: 7,
          assists: 2,
          steals: 1,
          fouls: 2,
          approximate_minutes: 26,
          recorded_by: USER.adminCoach,
          updated_by: USER.adminCoach,
        },
      ],
    ],
    [
      "post_game_reviews",
      "id",
      [
        {
          id: "e5000000-0000-4000-8000-000000000001",
          game_event_id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          what_worked:
            "Synthetic example: shared the ball and communicated on defence.",
          needs_improvement:
            "Synthetic example: box out consistently after a shot.",
          completed_by: USER.adminCoach,
          completed_at: now,
        },
      ],
    ],
    [
      "post_game_review_focus",
      "review_id,focus_code",
      [
        {
          review_id: "e5000000-0000-4000-8000-000000000001",
          focus_code: "REBOUNDING",
        },
      ],
    ],
    [
      "player_game_recognitions",
      "id",
      [
        {
          id: "e6000000-0000-4000-8000-000000000001",
          game_event_id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          player_id: PLAYER_IDS[0],
          category: "HUSTLE",
          note: "Synthetic recognition example.",
          created_by: USER.adminCoach,
          updated_by: USER.adminCoach,
        },
      ],
    ],
    [
      "private_player_game_notes",
      "game_event_id,player_id",
      [
        {
          game_event_id: EVENT.completed,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          player_id: PLAYER_IDS[0],
          note: "Synthetic STAFF_PRIVATE example; contains no real child information.",
          visibility: "STAFF_PRIVATE",
          author_user_id: USER.adminCoach,
          updated_by: USER.adminCoach,
        },
      ],
    ],
    [
      "practice_plans",
      "id",
      [
        {
          id: PLAN,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          training_event_id: EVENT.training,
          is_template: false,
          title: "Synthetic ball movement practice",
          notes: "Pilot example; synthetic content only.",
          created_by: USER.adminCoach,
          updated_by: USER.adminCoach,
        },
      ],
    ],
    [
      "practice_plan_focus",
      "practice_plan_id,source_review_id,focus_code",
      [
        {
          practice_plan_id: PLAN,
          team_id: PRIMARY_TEAM,
          club_id: CLUB,
          source_review_id: "e5000000-0000-4000-8000-000000000001",
          source_event_id: EVENT.completed,
          focus_code: "REBOUNDING",
        },
      ],
    ],
    [
      "practice_blocks",
      "id",
      [
        {
          id: "e7000000-0000-4000-8000-000000000001",
          practice_plan_id: PLAN,
          club_id: CLUB,
          team_id: PRIMARY_TEAM,
          sort_order: 1,
          drill_id: null,
          title: "Three-player passing weave",
          duration_minutes: 12,
          instructions:
            "Synthetic drill: move, call, and pass to the next station.",
        },
      ],
    ],
  ];

  const rpcOwnedTables = new Set([
    "game_player_stats",
    "post_game_reviews",
    "post_game_review_focus",
    "player_game_recognitions",
    "private_player_game_notes",
    "practice_plan_focus",
    "practice_blocks",
  ]);
  for (const [table, conflict, data] of rows) {
    if (rpcOwnedTables.has(table)) continue;
    await upsert(serviceKey, table, conflict, data);
  }
  const gameResultExpected = {
    team_score: 42,
    opponent_score: 36,
    result_status: "FINAL",
    source: "MANUAL",
  };
  if (
    !(await seedRowMatches(
      serviceKey,
      "games",
      { event_id: `eq.${EVENT.completed}` },
      gameResultExpected,
      ["team_score", "opponent_score", "result_status", "source"],
    ))
  ) {
    const games = await request(
      serviceKey,
      `/rest/v1/games?select=team_score,opponent_score,result_status,source&event_id=eq.${EVENT.completed}`,
      "GET",
    );
    const current = Array.isArray(games) ? games[0] : undefined;
    if (
      !isRecord(current) ||
      current.source !== "MANUAL" ||
      current.team_score !== null ||
      current.opponent_score !== null ||
      current.result_status !== null
    ) {
      throw new Error(
        "Existing synthetic game result conflicts with the seed baseline; refusing to overwrite it.",
      );
    }
    await rpc(publicKey, coachSession, "save_manual_game_result", {
      p_event_id: EVENT.completed,
      p_team_score: 42,
      p_opponent_score: 36,
    });
  }

  const statRows = [
    {
      playerId: PLAYER_IDS[0],
      points: 12,
      rebounds: 5,
      assists: 3,
      steals: 2,
      fouls: 1,
      approximate_minutes: 28,
    },
    {
      playerId: PLAYER_IDS[1],
      points: 8,
      rebounds: 7,
      assists: 2,
      steals: 1,
      fouls: 2,
      approximate_minutes: 26,
    },
  ] as const;
  for (const stat of statRows) {
    const expected = {
      points: stat.points,
      rebounds: stat.rebounds,
      assists: stat.assists,
      steals: stat.steals,
      fouls: stat.fouls,
      approximate_minutes: stat.approximate_minutes,
    };
    if (
      !(await seedRowMatches(
        serviceKey,
        "game_player_stats",
        {
          game_event_id: `eq.${EVENT.completed}`,
          player_id: `eq.${stat.playerId}`,
        },
        expected,
        [
          "points",
          "rebounds",
          "assists",
          "steals",
          "fouls",
          "approximate_minutes",
        ],
      ))
    ) {
      await rpc(publicKey, coachSession, "save_game_player_stat", {
        p_event_id: EVENT.completed,
        p_player_id: stat.playerId,
        p_points: stat.points,
        p_rebounds: stat.rebounds,
        p_assists: stat.assists,
        p_steals: stat.steals,
        p_fouls: stat.fouls,
        p_approximate_minutes: stat.approximate_minutes,
      });
    }
  }

  const reviewExpected = {
    what_worked:
      "Synthetic example: shared the ball and communicated on defence.",
    needs_improvement: "Synthetic example: box out consistently after a shot.",
  };
  const reviewRows = await request(
    serviceKey,
    `/rest/v1/post_game_reviews?select=id,what_worked,needs_improvement,completed_at&game_event_id=eq.${EVENT.completed}`,
    "GET",
  );
  if (!Array.isArray(reviewRows) || reviewRows.some((row) => !isRecord(row))) {
    throw new Error("Unable to verify the synthetic post-game review.");
  }
  const reviewMatches =
    classifySeedRow(reviewRows as Json[], reviewExpected, [
      "what_worked",
      "needs_improvement",
    ]) === "matching";
  let reviewId: string;
  if (reviewMatches) {
    const existingReview = reviewRows[0];
    if (
      !isRecord(existingReview) ||
      typeof existingReview.id !== "string" ||
      typeof existingReview.completed_at !== "string"
    ) {
      throw new Error("The synthetic post-game review is not complete.");
    }
    reviewId = existingReview.id;
    const focusMatches = await seedRowMatches(
      serviceKey,
      "post_game_review_focus",
      { review_id: `eq.${reviewId}` },
      { focus_code: "REBOUNDING" },
      ["focus_code"],
    );
    if (!focusMatches) {
      throw new Error(
        "The existing synthetic post-game review focus conflicts with the seed baseline.",
      );
    }
  } else {
    const reviewIdResult = await rpc(
      publicKey,
      coachSession,
      "save_post_game_review",
      {
        p_event_id: EVENT.completed,
        p_what_worked: reviewExpected.what_worked,
        p_needs_improvement: reviewExpected.needs_improvement,
        p_focus_codes: ["REBOUNDING"],
        p_complete: true,
      },
    );
    if (typeof reviewIdResult !== "string") {
      throw new Error("Staging review operation did not return a review id.");
    }
    reviewId = reviewIdResult;
  }

  const recognitionExpected = { note: "Synthetic recognition example." };
  if (
    !(await seedRowMatches(
      serviceKey,
      "player_game_recognitions",
      {
        game_event_id: `eq.${EVENT.completed}`,
        player_id: `eq.${PLAYER_IDS[0]}`,
        category: "eq.HUSTLE",
      },
      recognitionExpected,
      ["note"],
    ))
  ) {
    await rpc(publicKey, coachSession, "save_player_game_recognition", {
      p_event_id: EVENT.completed,
      p_player_id: PLAYER_IDS[0],
      p_category: "HUSTLE",
      p_note: recognitionExpected.note,
    });
  }

  const privateNoteExpected = {
    note: "Synthetic STAFF_PRIVATE example; contains no real child information.",
    visibility: "STAFF_PRIVATE",
  };
  if (
    !(await seedRowMatches(
      serviceKey,
      "private_player_game_notes",
      {
        game_event_id: `eq.${EVENT.completed}`,
        player_id: `eq.${PLAYER_IDS[0]}`,
      },
      privateNoteExpected,
      ["note", "visibility"],
    ))
  ) {
    await rpc(publicKey, coachSession, "save_private_player_game_note", {
      p_event_id: EVENT.completed,
      p_player_id: PLAYER_IDS[0],
      p_note: privateNoteExpected.note,
    });
  }

  const practicePlanExpected = {
    id: PLAN,
    title: "Synthetic ball movement practice",
    notes: "Pilot example; synthetic content only.",
    training_event_id: EVENT.training,
    is_template: false,
  };
  const practicePlanMatches = await seedRowMatches(
    serviceKey,
    "practice_plans",
    { id: `eq.${PLAN}` },
    practicePlanExpected,
    ["id", "title", "notes", "training_event_id", "is_template"],
  );
  if (practicePlanMatches) {
    const blockMatches = await seedRowMatches(
      serviceKey,
      "practice_blocks",
      { practice_plan_id: `eq.${PLAN}` },
      {
        sort_order: 1,
        drill_id: null,
        title: "Three-player passing weave",
        duration_minutes: 12,
        instructions:
          "Synthetic drill: move, call, and pass to the next station.",
      },
      ["sort_order", "drill_id", "title", "duration_minutes", "instructions"],
    );
    const practiceFocusMatches = await seedRowMatches(
      serviceKey,
      "practice_plan_focus",
      {
        practice_plan_id: `eq.${PLAN}`,
        source_review_id: `eq.${reviewId}`,
        focus_code: "eq.REBOUNDING",
      },
      {
        practice_plan_id: PLAN,
        source_review_id: reviewId,
        source_event_id: EVENT.completed,
        focus_code: "REBOUNDING",
      },
      ["practice_plan_id", "source_review_id", "source_event_id", "focus_code"],
    );
    if (!blockMatches || !practiceFocusMatches) {
      throw new Error(
        "Existing synthetic practice plan details conflict with the seed baseline.",
      );
    }
  } else {
    await rpc(publicKey, coachSession, "save_practice_plan", {
      p_team_id: PRIMARY_TEAM,
      p_plan_id: PLAN,
      p_training_event_id: EVENT.training,
      p_title: practicePlanExpected.title,
      p_notes: practicePlanExpected.notes,
      p_blocks: [
        {
          block_id: null,
          order: 1,
          drill_id: null,
          title: "Three-player passing weave",
          duration_minutes: 12,
          instructions:
            "Synthetic drill: move, call, and pass to the next station.",
        },
      ],
      p_focus: [
        {
          source_review_id: reviewId,
          source_event_id: EVENT.completed,
          code: "REBOUNDING",
        },
      ],
    });
  }

  if (process.argv.slice(2).includes("--verify-access")) {
    const roleChecks = [
      {
        userId: USER.adminCoach,
        label: "Head Coach + Club Admin",
        allow: true,
      },
      { userId: USER.assistant, label: "Assistant Coach", allow: true },
      { userId: USER.adminOnly, label: "Club Admin only", allow: false },
      { userId: USER.manager, label: "Team Manager", allow: false },
      { userId: USER.guardianOne, label: "Guardian", allow: false },
      { userId: USER.otherTeamCoach, label: "Other-team Coach", allow: false },
    ] as const;
    for (const role of roleChecks) {
      let accessToken = sessions.get(role.userId);
      if (accessToken === undefined) {
        const user = USERS.find((candidate) => candidate.id === role.userId);
        if (user === undefined) {
          throw new Error(`Staging identity unavailable for ${role.label}.`);
        }
        accessToken = await createSession(serviceKey, publicKey, user.email);
        sessions.set(role.userId, accessToken);
      }
      const capabilityCalls = [
        {
          functionName: "read_game_coaching_stats",
          args: { p_event_id: EVENT.completed },
          allowedRowCount: 6,
        },
        {
          functionName: "list_private_player_game_notes",
          args: { p_event_id: EVENT.completed },
          allowedRowCount: 1,
        },
      ];
      for (const capability of capabilityCalls) {
        try {
          const result = await rpc(
            publicKey,
            accessToken,
            capability.functionName,
            capability.args,
          );
          if (!role.allow) {
            throw new Error(
              `Staging authorization smoke allowed denied role ${role.label} for ${capability.functionName}.`,
            );
          }
          if (
            !Array.isArray(result) ||
            result.length !== capability.allowedRowCount
          ) {
            throw new Error(
              `Staging authorization smoke returned an unexpected ${capability.functionName} projection for ${role.label} (rows: ${Array.isArray(result) ? result.length : "non-array"}).`,
            );
          }
        } catch (error) {
          if (role.allow) throw error;
          if (!(error instanceof Error) || !error.message.includes("[42501]")) {
            throw error;
          }
        }
      }
    }
    const guardianToken = sessions.get(USER.guardianOne);
    if (guardianToken === undefined)
      throw new Error("Guardian session unavailable.");
    const guardianAttendance = await rpc(
      publicKey,
      guardianToken,
      "list_managed_attendance",
      { p_event_id: EVENT.upcoming },
    );
    if (!Array.isArray(guardianAttendance) || guardianAttendance.length !== 1) {
      throw new Error("Guardian managed-attendance staging projection failed.");
    }
    console.log(
      `Staging access smoke passed for ${STAGING_PROJECT_REF}: coach-only stats/private-note allow and deny paths plus one Guardian-managed attendance row were verified.`,
    );
  } else {
    console.log(
      `Staging synthetic seed complete for ${STAGING_PROJECT_REF}: ${USERS.length} Auth users, 8 players, 2 teams, 6 events.`,
    );
  }
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown failure";
  // Only fixed, non-secret error text and HTTP status are allowed above.
  console.error(`Staging seed failed: ${message}`);
  process.exitCode = 1;
});
