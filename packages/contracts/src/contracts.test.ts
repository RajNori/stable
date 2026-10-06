import { describe, expect, it } from "vitest";

import {
  ApplicationError,
  CLUB_READ_CAPABILITY,
  ENV,
  SENSITIVE_METADATA_FIELDS,
  applicationErrorCodeSchema,
  currentClubContextSchema,
  principalSchema,
} from "./index.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const club = {
  id: clubId,
  name: "Mentone Mustangs",
  slug: "mentone-mustangs",
  timezone: "Australia/Melbourne",
  themeKey: "mustangs",
};

describe("current club context contract", () => {
  it("accepts an active club context with no team and no managed players", () => {
    const parsed = currentClubContextSchema.parse({
      userId,
      displayName: "Alex M",
      club,
      activeTeam: null,
      capabilities: [CLUB_READ_CAPABILITY],
      managedPlayerIds: [],
    });

    expect(parsed.club?.slug).toBe("mentone-mustangs");
    expect(parsed.activeTeam).toBeNull();
    expect(parsed.managedPlayerIds).toEqual([]);
  });

  it("accepts a context with no club", () => {
    const parsed = currentClubContextSchema.parse({
      userId,
      displayName: "Alex M",
      club: null,
      activeTeam: null,
      capabilities: [],
      managedPlayerIds: [],
    });

    expect(parsed.club).toBeNull();
    expect(parsed.capabilities).toEqual([]);
  });

  it("rejects a team payload and a global role field", () => {
    expect(
      currentClubContextSchema.safeParse({
        userId,
        displayName: "Alex M",
        club,
        activeTeam: { id: clubId },
        capabilities: [],
        managedPlayerIds: [],
      }).success,
    ).toBe(false);

    expect(
      currentClubContextSchema.safeParse({
        userId,
        displayName: "Alex M",
        club: null,
        activeTeam: null,
        capabilities: [],
        managedPlayerIds: [],
        role: "CLUB_ADMIN",
      }).success,
    ).toBe(false);
  });
});

describe("principal contract", () => {
  it("accepts a user id with or without a display name", () => {
    expect(principalSchema.parse({ userId }).userId).toBe(userId);
    expect(
      principalSchema.parse({ userId, displayName: "Alex M" }).displayName,
    ).toBe("Alex M");
  });

  it("rejects a global role and provider tokens", () => {
    expect(
      principalSchema.safeParse({ userId, role: "CLUB_ADMIN" }).success,
    ).toBe(false);
    expect(
      principalSchema.safeParse({ userId, accessToken: "secret" }).success,
    ).toBe(false);
  });
});

describe("application errors", () => {
  it("lists the stable error codes and carries one on the error", () => {
    expect(applicationErrorCodeSchema.parse("UNAUTHENTICATED")).toBe(
      "UNAUTHENTICATED",
    );
    expect(applicationErrorCodeSchema.safeParse("NOPE").success).toBe(false);

    const error = new ApplicationError("FORBIDDEN", "Not a member");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApplicationError");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Not a member");
  });
});

describe("frozen names", () => {
  it("uses publishable and secret key names", () => {
    expect(ENV.expoSupabasePublishableKey).toBe(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    expect(ENV.nextSupabasePublishableKey).toBe(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    expect(ENV.supabaseSecretKey).toBe("SUPABASE_SECRET_KEY");
    expect(Object.values(ENV).join(" ")).not.toContain("ANON_KEY");
    expect(Object.values(ENV).join(" ")).not.toContain("SERVICE_ROLE");
  });

  it("names the sensitive metadata fields observability must reject", () => {
    expect(SENSITIVE_METADATA_FIELDS).toEqual([
      "email",
      "phone",
      "token",
      "otp",
      "playerName",
      "firstName",
      "lastName",
      "first_name",
      "last_name",
      "privateNote",
      "absenceNote",
    ]);
  });
});
