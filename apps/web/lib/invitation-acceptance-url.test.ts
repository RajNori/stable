import { readFileSync } from "node:fs";

import { invitationMessages } from "@stable/invitations";
import { describe, expect, it } from "vitest";

import { invitationQueryRedirect } from "./invitation-accept-request";
import {
  invitationAcceptanceUrl,
  readFragmentToken,
  scrubbedAcceptanceUrl,
} from "./invitation-acceptance-url";

const token = "ab".repeat(32);

describe("invitation acceptance url", () => {
  it("carries the raw token in the fragment and not the query", () => {
    const link = invitationAcceptanceUrl("https://club.example", token);
    const url = new URL(link);
    const requestTarget = `${url.pathname}${url.search}`;

    expect(link.includes("?token=")).toBe(false);
    expect(url.searchParams.has("token")).toBe(false);
    expect(requestTarget).toBe("/invitations/accept");
    expect(requestTarget.includes(token)).toBe(false);
    expect(url.hash).toBe(`#${token}`);
  });

  it("reads only a 64-character lowercase token from the fragment", () => {
    expect(readFragmentToken(`#${token}`)).toBe(token);
    expect(readFragmentToken("")).toBeNull();
    expect(readFragmentToken("#")).toBeNull();
    expect(readFragmentToken("#not-a-token")).toBeNull();
    expect(readFragmentToken(`#${token.toUpperCase()}`)).toBeNull();
    expect(readFragmentToken(`#${token}extra`)).toBeNull();
  });

  it("removes the fragment and any token query from the visible url", () => {
    const scrubbed = scrubbedAcceptanceUrl(
      new URL(
        `https://club.example/invitations/accept?token=${token}&result=Invitation%20accepted.#${token}`,
      ),
    );

    expect(scrubbed.startsWith("/invitations/accept?result=")).toBe(true);
    expect(scrubbed.includes("Invitation")).toBe(true);
    expect(scrubbed.includes(token)).toBe(false);
    expect(scrubbed.includes("?token=")).toBe(false);
  });

  it("drops a query token without copying it into the redirect", () => {
    const redirectTo = invitationQueryRedirect({
      token,
      result: "person@example.com",
    });

    expect(redirectTo).toBe("/invitations/accept");
    expect(redirectTo?.includes(token)).toBe(false);
    expect(redirectTo?.includes("person@example.com")).toBe(false);
  });

  it("keeps an allowlisted result when stripping a query token", () => {
    const redirectTo = invitationQueryRedirect({
      token: [token],
      result: invitationMessages.accepted,
    });

    expect(redirectTo).toBe(
      "/invitations/accept?result=Invitation%20accepted.",
    );
    expect(redirectTo?.includes(token)).toBe(false);
  });

  it("does not redirect an acceptance result that has no token query", () => {
    expect(
      invitationQueryRedirect({ result: invitationMessages.expired }),
    ).toBeNull();
  });

  it("does not send the token to storage, analytics, or logging", () => {
    const sources = [
      "./invitation-acceptance-url.ts",
      "./invitation-accept-request.ts",
      "../components/accept-invitation-handoff.tsx",
      "../components/invitation-panel.tsx",
      "../app/invitations/accept/page.tsx",
      "../app/invitations/actions.ts",
    ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
    const combined = sources.join("\n");

    expect(combined.includes("localStorage")).toBe(false);
    expect(combined.includes("sessionStorage")).toBe(false);
    expect(combined.includes("document.cookie")).toBe(false);
    expect(combined.includes("posthog")).toBe(false);
    expect(combined.includes("Sentry")).toBe(false);
    expect(combined.includes("captureProductEvent")).toBe(false);
    expect(combined.includes("console.")).toBe(false);
  });
});
