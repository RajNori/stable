import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerDisplayError,
  childDisplayName,
  firstGrapheme,
  formatChildDisplayName,
  openIntlSegmenter,
  registeredPlayerName,
} from "./child-display-name.js";

const originalSegmenter = Object.getOwnPropertyDescriptor(Intl, "Segmenter");

afterEach(() => {
  if (originalSegmenter !== undefined) {
    Object.defineProperty(Intl, "Segmenter", originalSegmenter);
  }
});

describe("child display name", () => {
  it("uses the first name and the first grapheme of the surname", () => {
    expect(childDisplayName("Alexander", "Robertson")).toBe("Alexander R.");
    expect(childDisplayName(" Wei ", " L ")).toBe("Wei L.");
    expect(childDisplayName("Sam", "Smith-Jones")).toBe("Sam S.");
    expect(childDisplayName("Sam", "O'Brien")).toBe("Sam O.");
    expect(childDisplayName("Alex", "van der Berg")).toBe("Alex v.");
    expect(childDisplayName("Wei", "Álvarez")).toBe("Wei Á.");
    expect(childDisplayName("Wei", "李")).toBe("Wei 李.");
    expect(childDisplayName("Name", "e\u0301clair")).toBe("Name e\u0301.");
  });

  it("does not store a mask, uppercase the initial, or fall back to the surname", () => {
    const masked = childDisplayName("Alexander", "Robertson");
    expect(masked).not.toBe("Alexander Robertson");
    expect(masked.endsWith("Robertson")).toBe(false);
    expect(childDisplayName("Alex", "van der Berg").endsWith("v.")).toBe(true);

    expect(() =>
      formatChildDisplayName("Alexander", "Robertson", () => null),
    ).toThrow(PlayerDisplayError);
    try {
      formatChildDisplayName("Alexander", "Robertson", () => null);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PlayerDisplayError);
      expect(error instanceof Error ? error.message : "").not.toContain(
        "Robertson",
      );
      expect(error instanceof Error ? error.message : "").not.toContain(
        "Alexander",
      );
    }

    expect(() =>
      formatChildDisplayName("Alexander", "Robertson", () => ""),
    ).toThrow(PlayerDisplayError);
  });

  it("rejects a missing or invalid name instead of inventing an initial", () => {
    expect(() => childDisplayName(" ", "Robertson")).toThrow(
      PlayerDisplayError,
    );
    expect(() => childDisplayName("Alexander", " ")).toThrow(
      PlayerDisplayError,
    );
    expect(() => childDisplayName("Alexander\n", "Robertson")).toThrow(
      PlayerDisplayError,
    );
    expect(firstGrapheme("")).toBeNull();
    expect(
      firstGrapheme("李", () => ({
        segment() {
          return [];
        },
      })),
    ).toBeNull();
    expect(
      firstGrapheme("李", () => ({
        segment() {
          return [{ segment: "" }];
        },
      })),
    ).toBeNull();
  });

  it("fails closed when the runtime cannot segment graphemes", () => {
    expect(() => firstGrapheme("李", () => null)).toThrow(PlayerDisplayError);
    try {
      firstGrapheme("李", () => null);
    } catch (error: unknown) {
      expect(error instanceof Error ? error.message : "").not.toContain("李");
    }

    Reflect.deleteProperty(Intl, "Segmenter");
    expect(openIntlSegmenter()).toBeNull();
    expect(() => childDisplayName("Wei", "李")).toThrow(PlayerDisplayError);
  });

  it("fails closed when Intl itself is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Intl");
    Reflect.deleteProperty(globalThis, "Intl");
    try {
      expect(openIntlSegmenter()).toBeNull();
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, "Intl", descriptor);
      }
    }
  });
});

describe("registered player name", () => {
  it("returns the trimmed registered name for club admin management", () => {
    expect(registeredPlayerName(" Alexander ", " Robertson ")).toBe(
      "Alexander Robertson",
    );
    expect(registeredPlayerName("Wei", "李")).toBe("Wei 李");
  });

  it("rejects an invalid registered name without echoing it", () => {
    expect(() => registeredPlayerName(" ", "Robertson")).toThrow(
      PlayerDisplayError,
    );
    try {
      registeredPlayerName("Alexander", " ");
    } catch (error: unknown) {
      expect(error instanceof Error ? error.message : "").not.toContain(
        "Alexander",
      );
    }
  });
});
