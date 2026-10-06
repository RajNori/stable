import { normalizePlayerName } from "@stable/contracts";

/**
 * Full registered child names are permitted only inside authorized Club Admin
 * player-management surfaces. Guardian and general-facing surfaces use
 * childDisplayName.
 *
 * The masked form is derived. It is not stored.
 * registeredPlayerName is the formatter for those admin surfaces only.
 */

const DISPLAY_FAILED = "Child display name failed validation.";
const REGISTERED_FAILED = "Registered player name failed validation.";
const SEGMENTER_FAILED = "Child display name could not be derived.";

export class PlayerDisplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerDisplayError";
  }
}

type GraphemeSegment = {
  segment: string;
};

type GraphemeSource = {
  segment(value: string): Iterable<GraphemeSegment>;
};

type GraphemeSegmenterConstructor = new (
  locales: undefined,
  options: { granularity: "grapheme" },
) => GraphemeSource;

function isSegmenterConstructor(
  value: unknown,
): value is GraphemeSegmenterConstructor {
  return typeof value === "function";
}

function readIntlRecord(): Record<string, unknown> | null {
  const value: unknown = globalThis.Intl;
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function openIntlSegmenter(): GraphemeSource | null {
  const intl = readIntlRecord();
  if (intl === null) {
    return null;
  }
  const candidate = intl["Segmenter"];
  if (!isSegmenterConstructor(candidate)) {
    return null;
  }
  return new candidate(undefined, { granularity: "grapheme" });
}

export function firstGrapheme(
  value: string,
  open: () => GraphemeSource | null = openIntlSegmenter,
): string | null {
  const source = open();
  if (source === null) {
    throw new PlayerDisplayError(SEGMENTER_FAILED);
  }
  const iterator = source.segment(value)[Symbol.iterator]();
  const next = iterator.next();
  if (next.done === true) {
    return null;
  }
  if (next.value.segment.length === 0) {
    return null;
  }
  return next.value.segment;
}

export function formatChildDisplayName(
  firstName: string,
  lastName: string,
  readInitial: (surname: string) => string | null,
): string {
  const first = normalizePlayerName(firstName);
  const last = normalizePlayerName(lastName);
  if (first === null || last === null) {
    throw new PlayerDisplayError(DISPLAY_FAILED);
  }
  const initial = readInitial(last);
  if (initial === null || initial.length === 0) {
    throw new PlayerDisplayError(DISPLAY_FAILED);
  }
  return `${first} ${initial}.`;
}

export function childDisplayName(firstName: string, lastName: string): string {
  return formatChildDisplayName(firstName, lastName, firstGrapheme);
}

export function registeredPlayerName(
  firstName: string,
  lastName: string,
): string {
  const first = normalizePlayerName(firstName);
  const last = normalizePlayerName(lastName);
  if (first === null || last === null) {
    throw new PlayerDisplayError(REGISTERED_FAILED);
  }
  return `${first} ${last}`;
}
