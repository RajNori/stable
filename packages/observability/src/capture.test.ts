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
      message: "reported",
    });
    expect(forwarded).not.toBe(error);
    expect(forwarded).not.toBeInstanceOf(Error);
  });

  it("redacts sensitive values from the message, cause, and context", () => {
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
      message: "Unavailable",
    });
    expect(sink.mock.calls[3]?.[0]).toMatchObject({
      classification: "unknown",
      message: "Unavailable",
    });
    expect(JSON.stringify(sink.mock.calls[1]?.[0])).toContain(
      `"message":"${"a".repeat(300)}"`,
    );

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
      message: "loop",
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
});
