import { ApplicationError, SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
import type { ProductEventMetadata } from "@stable/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  captureException,
  captureProductEvent,
  configureObservability,
} from "./index.js";

describe("captureException", () => {
  it("is a no-op when no public DSN is configured", () => {
    const sink = vi.fn();
    configureObservability({ exceptionSink: sink });

    const weird = {
      get message(): string {
        throw new Error("must not be read");
      },
    };

    expect(() => captureException(weird)).not.toThrow();
    expect(() => captureException(undefined)).not.toThrow();
    expect(() => captureException(Symbol("error"))).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("treats a blank DSN as unconfigured", () => {
    const sink = vi.fn();
    configureObservability({ sentryDsn: "   ", exceptionSink: sink });

    expect(() => captureException(new Error("blank"))).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("does not throw when a configured sink fails", () => {
    const sink = vi.fn(() => {
      throw new Error("sink down");
    });
    configureObservability({
      sentryDsn: "https://example.invalid/1",
      exceptionSink: sink,
    });

    expect(() => captureException(new Error("boom"))).not.toThrow();
    expect(sink).toHaveBeenCalledOnce();
  });

  it("sends a normalized error when a DSN and sink are configured", () => {
    const error = new Error("reported");
    const sink = vi.fn();
    configureObservability({
      sentryDsn: " https://example.invalid/1 ",
      exceptionSink: sink,
    });

    captureException(error);

    const forwarded: unknown = sink.mock.calls[0]?.[0];
    expect(forwarded).toEqual({
      name: "Error",
      classification: "Error",
      message: "An application error occurred.",
    });
    expect(forwarded).not.toBe(error);
    expect(forwarded).not.toBeInstanceOf(Error);
  });

  it("never forwards error messages or arbitrary context", () => {
    const token = "sb_secret_example";
    const note = "coach-only note";
    const error = new ApplicationError(
      "VALIDATION_FAILED",
      "member person@example.com otp 918273 phone +61400111222",
    );
    error.cause = new Error(`nested ${token}`);
    Object.assign(error, {
      email: "person@example.com",
      phone: "+61400111222",
      token,
      otp: "918273",
      playerName: "Alex Player",
      privateNote: note,
      absenceNote: "sick today",
      userId: "synthetic-user-id",
      requestBody: {
        childName: "Alex Player",
        privatePlayerNote: note,
        email: "person@example.com",
        phone: "+61400111222",
        access_token: token,
      },
      headers: { authorization: `Bearer ${token}` },
      url: "https://staging.invalid/auth/callback?token=otp-918273",
      context: {
        playerName: "Alex Player",
        privateNote: note,
        cause: { absenceNote: "sick today", token },
      },
    });
    const sink = vi.fn();
    configureObservability({
      sentryDsn: "https://example.invalid/1",
      exceptionSink: sink,
    });

    captureException(error);

    const forwarded: unknown = sink.mock.calls[0]?.[0];
    const encoded = JSON.stringify(forwarded);
    expect(forwarded).toMatchObject({
      name: "ApplicationError",
      classification: "VALIDATION_FAILED",
      cause: { classification: "Error" },
    });
    expect(encoded).not.toContain("person@example.com");
    expect(encoded).not.toContain("+61400111222");
    expect(encoded).not.toContain(token);
    expect(encoded).not.toContain("918273");
    expect(encoded).not.toContain("Alex Player");
    expect(encoded).not.toContain(note);
    expect(encoded).not.toContain("sick today");
    expect(encoded).not.toContain('"context"');
    expect(encoded).not.toContain('"email"');
    expect(encoded).not.toContain('"phone"');
    expect(encoded).not.toContain('"userId"');
    expect(encoded).not.toContain('"requestBody"');
    expect(encoded).not.toContain('"headers"');
    expect(encoded).not.toContain('"url"');
    expect(encoded).not.toContain("staging.invalid");
    expect(encoded).not.toContain("member");
    expect(encoded).not.toContain("nested");
  });

  it("normalizes strings, unnamed values, and nested sensitive lists", () => {
    const sink = vi.fn();
    configureObservability({
      sentryDsn: "https://example.invalid/1",
      exceptionSink: sink,
    });
    const named = new Error("x");
    named.name = "Not A Name";
    named.message = `${"a".repeat(400)} Bearer abc.def person@example.com sb_publishable_ci`;

    captureException("otp=918273 person@example.com");
    captureException(named);
    captureException({
      message: 12,
      email: { address: "hidden@example.com" },
      tags: [{ playerName: "Alex Player" }],
    });
    captureException(42);

    const encoded = JSON.stringify(sink.mock.calls);
    expect(encoded).not.toContain("person@example.com");
    expect(encoded).not.toContain("hidden@example.com");
    expect(encoded).not.toContain("918273");
    expect(encoded).not.toContain("Alex Player");
    expect(encoded).not.toContain("sb_publishable_ci");
    expect(encoded).not.toContain("abc.def");
    expect(sink.mock.calls[1]?.[0]).toMatchObject({
      name: "Error",
      classification: "Error",
    });
    expect(sink.mock.calls[2]?.[0]).toMatchObject({
      classification: "unknown",
      message: "An application error occurred.",
    });
    expect(sink.mock.calls[3]?.[0]).toMatchObject({
      classification: "unknown",
      message: "An application error occurred.",
    });
    expect(sink.mock.calls[1]?.[0]).toMatchObject({
      message: "An application error occurred.",
    });

    const circular: { context?: object; playerName: string } = {
      playerName: "Alex Player",
    };
    circular.context = circular;
    let deep: object = { playerName: "Deep Name" };
    for (let index = 0; index < 8; index += 1) {
      deep = { context: deep };
    }
    expect(() => captureException(circular)).not.toThrow();
    expect(() => captureException(deep)).not.toThrow();
  });

  it("redacts a sensitive value that lives only on a non-enumerable cause", () => {
    const note = "coach-only note";
    const error = new Error(`failed ${note}`, {
      cause: { privateNote: note, playerName: "Alex Player" },
    });
    const sink = vi.fn();
    configureObservability({
      sentryDsn: "https://example.invalid/1",
      exceptionSink: sink,
    });

    captureException(error);

    const encoded = JSON.stringify(sink.mock.calls[0]?.[0]);
    expect(encoded).not.toContain(note);
    expect(encoded).not.toContain("Alex Player");
    expect(sink.mock.calls[0]?.[0]).not.toBe(error);
  });

  it("does not follow a circular cause", () => {
    const error = new Error("loop");
    error.cause = error;
    const sink = vi.fn();
    configureObservability({
      sentryDsn: "https://example.invalid/1",
      exceptionSink: sink,
    });

    expect(() => captureException(error)).not.toThrow();
    expect(sink.mock.calls[0]?.[0]).toMatchObject({
      message: "An application error occurred.",
      cause: { message: "[redacted]" },
    });
  });

  it("does not throw when a DSN is configured and no sink is installed", () => {
    configureObservability({ sentryDsn: "https://example.invalid/1" });

    expect(() => captureException({ circular: true })).not.toThrow();
  });
});

describe("captureProductEvent", () => {
  it("is a no-op when no PostHog key is configured", () => {
    const sink = vi.fn();
    configureObservability({ productEventSink: sink });

    expect(() =>
      captureProductEvent("game_day_opened", { teamId: "team-1" }),
    ).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("treats a blank PostHog key as unconfigured", () => {
    const sink = vi.fn();
    configureObservability({ posthogKey: " ", productEventSink: sink });

    captureProductEvent("training_opened", { eventId: "event-1" });

    expect(sink).not.toHaveBeenCalled();
  });

  it("sends only the allowed metadata when a key and sink are configured", () => {
    const sink = vi.fn();
    configureObservability({
      posthogKey: " phc_test ",
      productEventSink: sink,
    });
    const metadata = {
      teamId: "team-1",
      eventId: "event-1",
      clubId: "club-1",
      userId: "user-1",
    } satisfies ProductEventMetadata;

    captureProductEvent("attendance_confirmed", metadata);

    expect(sink).toHaveBeenCalledWith("attendance_confirmed", metadata);
  });

  it("does not throw when analytics fails", () => {
    const sink = vi.fn(() => {
      throw new Error("analytics down");
    });
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });

    expect(() =>
      captureProductEvent("announcement_acknowledged", { clubId: "club-1" }),
    ).not.toThrow();
  });

  it("does not throw when a key is configured and no sink is installed", () => {
    configureObservability({ posthogKey: "phc_test" });

    expect(() =>
      captureProductEvent("duty_swap_requested", { userId: "user-1" }),
    ).not.toThrow();
  });

  it("rejects sensitive metadata fields at compile time and at runtime", () => {
    const sink = vi.fn();
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });

    // @ts-expect-error email is not product event metadata
    captureProductEvent("game_day_opened", { email: "person@example.com" });
    // @ts-expect-error phone is not product event metadata
    captureProductEvent("game_day_opened", { phone: "+61400000000" });
    // @ts-expect-error token is not product event metadata
    captureProductEvent("game_day_opened", { token: "secret-token" });
    // @ts-expect-error otp is not product event metadata
    captureProductEvent("game_day_opened", { otp: "123456" });
    // @ts-expect-error playerName is not product event metadata
    captureProductEvent("game_day_opened", { playerName: "A Player" });
    // @ts-expect-error privateNote is not product event metadata
    captureProductEvent("game_day_opened", { privateNote: "private" });
    // @ts-expect-error absenceNote is not product event metadata
    captureProductEvent("game_day_opened", { absenceNote: "sick" });

    const leaked: ProductEventMetadata = { teamId: "team-1" };
    Object.assign(leaked, { email: "person@example.com" });
    captureProductEvent("attendance_confirmed", leaked);

    expect(sink).not.toHaveBeenCalled();
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

  it("drops malformed metadata without throwing", () => {
    const sink = vi.fn();
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });

    expect(() =>
      captureProductEvent(
        "practice_plan_created",
        null as unknown as ProductEventMetadata,
      ),
    ).not.toThrow();
    expect(() =>
      captureProductEvent("practice_plan_created", [
        "email",
      ] as unknown as ProductEventMetadata),
    ).not.toThrow();
    expect(() =>
      captureProductEvent(
        "practice_plan_created",
        "email" as unknown as ProductEventMetadata,
      ),
    ).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("rejects nested child names and does not send them to the sink", () => {
    const sink = vi.fn();
    const logs = spyOnConsole();
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });

    expect(() =>
      captureProductEvent("game_day_opened", {
        teamId: "team-1",
        context: { firstName: "Synthetic" },
      } as unknown as ProductEventMetadata),
    ).not.toThrow();
    expect(() =>
      captureProductEvent("game_day_opened", {
        teamId: "team-1",
        context: { last_name: "Player" },
      } as unknown as ProductEventMetadata),
    ).not.toThrow();

    expect(sink).not.toHaveBeenCalled();
    expect(logs.output()).not.toContain("Synthetic");
    expect(logs.output()).not.toContain("Player");
    logs.restore();
  });

  it("rejects case-variant child-name keys without logging the value", () => {
    const sink = vi.fn();
    const logs = spyOnConsole();
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });
    const variants = [
      "firstName",
      "FIRSTNAME",
      "FirstName",
      "first_name",
      "LAST_NAME",
    ];

    for (const key of variants) {
      expect(() =>
        captureProductEvent("game_day_opened", {
          teamId: "team-1",
          [key]: "Synthetic",
        } as unknown as ProductEventMetadata),
      ).not.toThrow();
    }

    expect(sink).not.toHaveBeenCalled();
    expect(logs.output()).not.toContain("Synthetic");
    logs.restore();
  });

  it("rejects nested objects, arrays, and unknown metadata keys", () => {
    const sink = vi.fn();
    configureObservability({
      posthogKey: "phc_test",
      productEventSink: sink,
    });

    expect(() =>
      captureProductEvent("game_day_opened", {
        teamId: { firstName: "Synthetic" },
      } as unknown as ProductEventMetadata),
    ).not.toThrow();
    expect(() =>
      captureProductEvent("game_day_opened", {
        teamId: ["team-1"],
      } as unknown as ProductEventMetadata),
    ).not.toThrow();
    expect(() =>
      captureProductEvent("game_day_opened", {
        teamId: "team-1",
        note: "not-a-supported-field",
      } as unknown as ProductEventMetadata),
    ).not.toThrow();

    expect(sink).not.toHaveBeenCalled();
  });
});

const CONSOLE_METHODS = ["debug", "error", "info", "log", "warn"] as const;

type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

function spyOnConsole(): { output: () => string; restore: () => void } {
  const host: unknown = globalThis;
  const consoleObject = readConsole(host);
  const spies =
    consoleObject === null
      ? []
      : CONSOLE_METHODS.map((method) =>
          vi.spyOn(consoleObject, method).mockImplementation(() => undefined),
        );
  return {
    output() {
      return spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .map((value) => String(value))
        .join("\n");
    },
    restore() {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
}

function readConsole(
  host: unknown,
): Record<ConsoleMethod, (...args: readonly unknown[]) => void> | null {
  if (typeof host !== "object" || host === null) {
    return null;
  }
  const candidate = (host as Record<string, unknown>)["console"];
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  for (const method of CONSOLE_METHODS) {
    if (typeof record[method] !== "function") {
      return null;
    }
  }
  return record as Record<ConsoleMethod, (...args: readonly unknown[]) => void>;
}
