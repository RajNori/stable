import { describe, expect, it } from "vitest";

import { safeSentryEvent } from "./sentry-event.js";

describe("safeSentryEvent", () => {
  it("keeps only the event id and approved runtime metadata", () => {
    const result = safeSentryEvent(
      {
        event_id: "0123456789abcdef0123456789abcdef",
        message: "child name and private note",
        exception: { values: [{ value: "raw provider response" }] },
        user: { id: "adult-id", email: "adult@example.com" },
        request: { url: "/?token=secret", data: "request body" },
        breadcrumbs: [{ message: "private navigation" }],
        contexts: { child: { name: "Synthetic" } },
        extra: { authToken: "secret" },
        tags: { teamId: "team-id" },
      },
      {
        environment: "staging",
        runtime: "web",
        release: "8ad5184",
      },
    );

    expect(result).toEqual({
      event_id: "0123456789abcdef0123456789abcdef",
      platform: "javascript",
      level: "error",
      message: "An application error occurred.",
      exception: {
        values: [
          {
            type: "Error",
            value: "An application error occurred.",
          },
        ],
      },
      environment: "staging",
      release: "8ad5184",
      fingerprint: ["the-stable", "application-error"],
      tags: { application: "the-stable", runtime: "web" },
    });
  });

  it("drops malformed ids and free-form release strings", () => {
    const result = safeSentryEvent(
      {
        event_id: "person@example.com",
        request: { url: "https://example.invalid/?token=secret" },
      },
      {
        environment: "local",
        runtime: "mobile",
        release: "SyntheticChild",
      },
    );

    expect(result).not.toHaveProperty("event_id");
    expect(result).not.toHaveProperty("release");
    expect(result).not.toHaveProperty("request");
    expect(result.tags).toEqual({
      application: "the-stable",
      runtime: "mobile",
    });
    expect(JSON.stringify(result)).not.toMatch(/SyntheticChild|token=secret/u);
  });
});
