import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENV } from "@stable/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ClubAdminShell } from "./club-admin-shell";
import {
  contextFixtureFromQuery,
  fixtureClubContextInput,
} from "../lib/fixtures";
import { loadClubContext } from "../lib/load-club-context";
import { readPublicSupabaseConfig } from "../lib/public-supabase-env";
import { createRuntimeClubContextReader } from "../lib/runtime-club-context-reader";

afterEach(() => {
  cleanup();
});

describe("current club context shell", () => {
  it("does not treat hidden admin chrome as authorization", async () => {
    const presentation = await loadClubContext(
      fixtureClubContextInput("outsider"),
    );

    render(<ClubAdminShell presentation={presentation} />);

    const hiddenChrome = screen.getByTestId("admin-chrome-link");
    expect(hiddenChrome.hidden).toBe(true);
    expect(hiddenChrome.textContent).toBe("Club settings");
    expect(screen.queryByRole("link", { name: "Club settings" })).toBeNull();
    expect(presentation.status).toBe("no-membership");
    expect(
      screen.getByLabelText("Club context").getAttribute("data-state"),
    ).toBe("no-membership");
    expect(screen.getByRole("status").textContent).toContain(
      "active club membership",
    );
    expect(
      screen.queryByRole("heading", { name: "Mentone Mustangs" }),
    ).toBeNull();
    expect(screen.queryByText("club.read")).toBeNull();
  });

  it("renders club name, display name, and club.read from the use case", async () => {
    const presentation = await loadClubContext(
      fixtureClubContextInput("member"),
    );

    render(<ClubAdminShell presentation={presentation} />);

    expect(screen.getByTestId("admin-chrome-link").hidden).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Mentone Mustangs" }),
    ).toBeTruthy();
    expect(screen.getByText("Jordan P")).toBeTruthy();
    expect(screen.getByText("club.read")).toBeTruthy();
    expect(
      screen.getByLabelText("Club context").getAttribute("data-state"),
    ).toBe("member");
    expect(
      screen.getByRole("heading", { name: "Needs attention" }),
    ).toBeTruthy();
  });

  it("shows a sign-in next step when the principal is missing", async () => {
    const presentation = await loadClubContext(
      fixtureClubContextInput("unauthenticated"),
    );

    render(<ClubAdminShell presentation={presentation} />);

    expect(presentation.status).toBe("unauthenticated");
    expect(screen.getByRole("status").textContent).toContain(
      "Authentication is required.",
    );
    expect(screen.getByText(/Sign in with the email address/)).toBeTruthy();
    expect(screen.queryByText("relation clubs")).toBeNull();
  });

  it("shows an error next step without reader driver text", async () => {
    const presentation = await loadClubContext(
      fixtureClubContextInput("error"),
    );

    render(<ClubAdminShell presentation={presentation} />);

    expect(presentation.status).toBe("error");
    expect(screen.getByRole("alert").textContent).toContain(
      "Club context could not be read.",
    );
    expect(screen.getByText(/Refresh this page/)).toBeTruthy();
    expect(screen.queryByText("relation clubs")).toBeNull();
  });

  it("shows a loading state", () => {
    render(<ClubAdminShell presentation={{ status: "loading" }} />);

    expect(screen.getByRole("status").textContent).toContain(
      "Loading club context.",
    );
    expect(
      screen.getByLabelText("Club context").getAttribute("data-state"),
    ).toBe("loading");
  });
});

describe("fixture mode", () => {
  it("accepts known fixtures only when NODE_ENV is test and the app is not production", () => {
    expect(contextFixtureFromQuery("member", { NODE_ENV: "test" })).toBe(
      "member",
    );
    expect(contextFixtureFromQuery("outsider", { NODE_ENV: "test" })).toBe(
      "outsider",
    );
    expect(
      contextFixtureFromQuery("unauthenticated", { NODE_ENV: "test" }),
    ).toBe("unauthenticated");
    expect(
      contextFixtureFromQuery("drop-table", { NODE_ENV: "test" }),
    ).toBeNull();
    expect(
      contextFixtureFromQuery("member", { NODE_ENV: "development" }),
    ).toBeNull();
    expect(
      contextFixtureFromQuery("member", {
        NODE_ENV: "test",
        NEXT_PUBLIC_APP_ENV: "production",
      }),
    ).toBeNull();
  });
});

describe("public supabase configuration", () => {
  it("returns only the publishable browser credentials", () => {
    const config = readPublicSupabaseConfig({
      [ENV.nextSupabaseUrl]: "http://127.0.0.1:54321",
      [ENV.nextSupabasePublishableKey]: "publishable-key",
      [ENV.supabaseSecretKey]: "super-secret",
    });

    expect(config).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "publishable-key",
    });
    expect(JSON.stringify(config)).not.toContain("super-secret");
  });
});

describe("supabase reader boundary", () => {
  it("uses the exported club context reader", async () => {
    const reader = await createRuntimeClubContextReader({});
    expect(typeof reader.read).toBe("function");
  });
});

describe("page boundary", () => {
  it("does not query tables or import database types from the page", () => {
    const readSource = (relativePath: string): string =>
      readFileSync(join(process.cwd(), relativePath), "utf8");
    const page = readSource("app/page.tsx");
    const loader = readSource("lib/load-club-context.ts");
    const shell = readSource("components/club-admin-shell.tsx");
    const browser = readSource("lib/supabase/browser.ts");
    const publicEnv = readSource("lib/public-supabase-env.ts");
    const server = readSource("lib/supabase/server.ts");

    expect(page).not.toContain("@stable/database-types");
    expect(page).not.toContain(".from(");
    expect(page).toContain("loadClubContext");
    expect(loader).toContain("getCurrentClubContext({");
    expect(shell).not.toContain("@stable/database-types");
    expect(shell).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(browser).toContain("createBrowserClient");
    expect(browser).not.toContain("supabaseSecretKey");
    expect(publicEnv).toContain("ENV.nextSupabaseUrl");
    expect(publicEnv).toContain("ENV.nextSupabasePublishableKey");
    expect(publicEnv).not.toContain("supabaseSecretKey");
    expect(server).toContain("createServerClient");
    expect(server).not.toContain("supabaseSecretKey");
  });
});
