import { SENSITIVE_METADATA_FIELDS } from "@stable/contracts";
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

  it("forwards the error when a DSN and sink are configured", () => {
    const error = new Error("reported");
    const sink = vi.fn();
    configureObservability({
      sentryDsn: " https://example.invalid/1 ",
      exceptionSink: sink,
    });

    captureException(error);

    expect(sink).toHaveBeenCalledWith(error);
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
