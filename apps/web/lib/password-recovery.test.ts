import { describe, expect, it } from "vitest";

import {
  RECOVERY_WINDOW_MS,
  isRecoveryRoute,
  recoveryDeadline,
  recoveryMarkerState,
  recoveryRedirectTo,
} from "./password-recovery";

describe("password recovery marker", () => {
  it("creates a short-lived deadline", () => {
    expect(recoveryDeadline(1_000)).toBe(String(1_000 + RECOVERY_WINDOW_MS));
  });

  it("distinguishes absent, active, malformed and expired markers", () => {
    expect(recoveryMarkerState(undefined, 1_000)).toBe("none");
    expect(recoveryMarkerState("2000", 1_000)).toBe("active");
    expect(recoveryMarkerState("1000", 1_000)).toBe("expired");
    expect(recoveryMarkerState("NaN", 1_000)).toBe("expired");
  });

  it("allows only the recovery route while recovery is pending", () => {
    expect(isRecoveryRoute("/auth/recover")).toBe(true);
    expect(isRecoveryRoute("/auth/recover/other")).toBe(false);
    expect(isRecoveryRoute("/club-structure")).toBe(false);
  });

  it("builds the recovery callback from the configured origin", () => {
    expect(recoveryRedirectTo("https://staging.stable.example")).toBe(
      "https://staging.stable.example/auth/callback?type=recovery",
    );
  });
});
