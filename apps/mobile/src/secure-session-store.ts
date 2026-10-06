/**
 * Chunked Expo SecureStore adapter for the Supabase auth persistence key.
 *
 * Expo SecureStore 57 does not enforce a byte cap in JavaScript, but a single
 * iOS keychain item and the historical SecureStore limit are not a safe place
 * for a full GoTrue session. Local email sessions already exceed 2048 UTF-8
 * bytes. Each stored value stays within that budget.
 *
 * Confidentiality is the platform keychain (iOS) or Android Keystore. The
 * digest detects a torn write. It is not encryption.
 *
 * Threat model: an attacker who can read the app's keychain can read every
 * chunk. Chunking does not add a new key, a new cipher, or a second session
 * record. A failed or partial write leaves the previous manifest in place, or
 * clears an unreadable value and returns null. Session bytes are never logged.
 */

export const SESSION_STORE_VALUE_BUDGET = 2048;
export const SESSION_STORE_CHUNK_BYTES = 1800;
export const SESSION_STORE_MAX_CHUNKS = 32;

const MANIFEST_KIND = "stable-auth-chunks";
const MANIFEST_VERSION = 1;
const STORE_FAILURE = "The session could not be stored.";
const READ_FAILURE = "The session could not be read.";
const REMOVE_FAILURE = "The session could not be removed.";

export type SecureSessionStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type ChunkedSessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type ChunkManifest = {
  readonly kind: typeof MANIFEST_KIND;
  readonly version: typeof MANIFEST_VERSION;
  readonly generation: string;
  readonly previousGeneration: string | null;
  readonly count: number;
  readonly bytes: number;
  readonly digest: string;
};

type WritingMarker = {
  readonly generation: string;
  readonly count: number;
};

let generationCounter = 0;

function nextGeneration(): string {
  generationCounter += 1;
  return `${Date.now().toString(16)}${generationCounter.toString(16)}`;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0);
    if (point === undefined) {
      continue;
    }
    if (point <= 0x7f) {
      bytes += 1;
    } else if (point <= 0x7ff) {
      bytes += 2;
    } else if (point <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

function integrityDigest(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function splitChunks(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of value) {
    const charBytes = utf8Bytes(char);
    if (charBytes > SESSION_STORE_CHUNK_BYTES) {
      throw new Error(STORE_FAILURE);
    }
    if (
      current.length > 0 &&
      currentBytes + charBytes > SESSION_STORE_CHUNK_BYTES
    ) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  if (chunks.length > SESSION_STORE_MAX_CHUNKS) {
    throw new Error(STORE_FAILURE);
  }
  return chunks;
}

function chunkKey(key: string, generation: string, index: number): string {
  return `${key}.${generation}.${index}`;
}

function writingKey(key: string): string {
  return `${key}.writing`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readManifest(raw: string): ChunkManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed["kind"] !== MANIFEST_KIND) {
    return null;
  }
  const version = parsed["version"];
  const generation = parsed["generation"];
  const previousGeneration = parsed["previousGeneration"];
  const count = parsed["count"];
  const bytes = parsed["bytes"];
  const digest = parsed["digest"];
  if (
    version !== MANIFEST_VERSION ||
    typeof generation !== "string" ||
    !/^[a-f0-9]+$/u.test(generation) ||
    (previousGeneration !== null && typeof previousGeneration !== "string") ||
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > SESSION_STORE_MAX_CHUNKS ||
    typeof bytes !== "number" ||
    !Number.isInteger(bytes) ||
    bytes < 0 ||
    typeof digest !== "string" ||
    !/^[a-f0-9]{16}$/u.test(digest)
  ) {
    return null;
  }
  if (previousGeneration !== null && !/^[a-f0-9]+$/u.test(previousGeneration)) {
    return null;
  }
  return {
    kind: MANIFEST_KIND,
    version: MANIFEST_VERSION,
    generation,
    previousGeneration,
    count,
    bytes,
    digest,
  };
}

function readWritingMarker(raw: string): WritingMarker | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const generation = parsed["generation"];
  const count = parsed["count"];
  if (
    typeof generation !== "string" ||
    !/^[a-f0-9]+$/u.test(generation) ||
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > SESSION_STORE_MAX_CHUNKS
  ) {
    return null;
  }
  return { generation, count };
}

async function readRaw(
  store: SecureSessionStore,
  key: string,
): Promise<string | null> {
  try {
    return await store.getItemAsync(key);
  } catch {
    throw new Error(READ_FAILURE);
  }
}

async function writeRaw(
  store: SecureSessionStore,
  key: string,
  value: string,
): Promise<void> {
  if (utf8Bytes(value) > SESSION_STORE_VALUE_BUDGET) {
    throw new Error(STORE_FAILURE);
  }
  try {
    await store.setItemAsync(key, value);
  } catch {
    throw new Error(STORE_FAILURE);
  }
}

async function deleteRaw(
  store: SecureSessionStore,
  key: string,
  required: boolean,
): Promise<void> {
  try {
    await store.deleteItemAsync(key);
  } catch {
    if (required) {
      throw new Error(REMOVE_FAILURE);
    }
  }
}

function looseGeneration(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const generation = parsed["generation"];
  if (typeof generation !== "string" || !/^[a-f0-9]+$/u.test(generation)) {
    return null;
  }
  return generation;
}

function classifyStored(raw: string): ChunkManifest | "legacy" | "corrupt" {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "legacy";
  }
  if (!isRecord(parsed) || parsed["kind"] !== MANIFEST_KIND) {
    return "legacy";
  }
  return readManifest(raw) ?? "corrupt";
}

async function deleteGeneration(
  store: SecureSessionStore,
  key: string,
  generation: string,
  required: boolean,
): Promise<void> {
  for (let index = 0; index < SESSION_STORE_MAX_CHUNKS; index += 1) {
    await deleteRaw(store, chunkKey(key, generation, index), required);
  }
}

async function discardWriting(
  store: SecureSessionStore,
  key: string,
  marker: WritingMarker,
  required: boolean,
): Promise<void> {
  await deleteGeneration(store, key, marker.generation, required);
  await deleteRaw(store, writingKey(key), required);
}

export function createChunkedSessionStorage(
  store: SecureSessionStore,
): ChunkedSessionStorage {
  const tails = new Map<string, Promise<unknown>>();

  function exclusive<T>(key: string, run: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const runAfter = previous.then(run, run);
    tails.set(
      key,
      runAfter.then(
        () => undefined,
        () => undefined,
      ),
    );
    return runAfter;
  }

  async function cleanupWriting(
    key: string,
    manifest: ChunkManifest | null,
  ): Promise<void> {
    const raw = await readRaw(store, writingKey(key));
    if (raw === null) {
      return;
    }
    const marker = readWritingMarker(raw);
    if (marker === null) {
      await deleteRaw(store, writingKey(key), false);
      return;
    }
    if (manifest !== null && manifest.generation === marker.generation) {
      await deleteRaw(store, writingKey(key), false);
      return;
    }
    await discardWriting(store, key, marker, false);
  }

  async function deleteStored(key: string): Promise<void> {
    const raw = await readRaw(store, key);
    const classified = raw === null ? null : classifyStored(raw);
    if (raw !== null && classified === "corrupt") {
      const generation = looseGeneration(raw);
      if (generation !== null) {
        await deleteGeneration(store, key, generation, true);
      }
    }
    if (
      classified !== null &&
      classified !== "legacy" &&
      classified !== "corrupt"
    ) {
      await deleteGeneration(store, key, classified.generation, true);
      if (classified.previousGeneration !== null) {
        await deleteGeneration(store, key, classified.previousGeneration, true);
      }
    }
    const writing = await readRaw(store, writingKey(key));
    if (writing !== null) {
      const marker = readWritingMarker(writing);
      if (marker !== null) {
        await deleteGeneration(store, key, marker.generation, true);
      }
      await deleteRaw(store, writingKey(key), true);
    }
    if (raw !== null) {
      await deleteRaw(store, key, true);
    }
  }

  async function writeStored(key: string, value: string): Promise<void> {
    const chunks = splitChunks(value);
    const existingRaw = await readRaw(store, key);
    const classified =
      existingRaw === null ? null : classifyStored(existingRaw);
    const existing =
      classified === null || classified === "legacy" || classified === "corrupt"
        ? null
        : classified;
    await cleanupWriting(key, existing);
    const generation = nextGeneration();
    const marker: WritingMarker = { generation, count: chunks.length };
    await writeRaw(store, writingKey(key), JSON.stringify(marker));
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (chunk === undefined) {
        throw new Error(STORE_FAILURE);
      }
      await writeRaw(store, chunkKey(key, generation, index), chunk);
    }
    const manifest: ChunkManifest = {
      kind: MANIFEST_KIND,
      version: MANIFEST_VERSION,
      generation,
      previousGeneration: existing === null ? null : existing.generation,
      count: chunks.length,
      bytes: utf8Bytes(value),
      digest: integrityDigest(value),
    };
    await writeRaw(store, key, JSON.stringify(manifest));
    await deleteRaw(store, writingKey(key), false);
    if (existing !== null && existing.generation !== generation) {
      await deleteGeneration(store, key, existing.generation, false);
    }
  }

  async function readStored(key: string): Promise<string | null> {
    const raw = await readRaw(store, key);
    if (raw === null) {
      await cleanupWriting(key, null);
      return null;
    }

    const classified = classifyStored(raw);
    if (classified === "corrupt") {
      await deleteStored(key);
      return null;
    }
    if (classified === "legacy") {
      try {
        await writeStored(key, raw);
      } catch {
        return raw;
      }
      return raw;
    }

    await cleanupWriting(key, classified);
    const parts: string[] = [];
    for (let index = 0; index < classified.count; index += 1) {
      const part = await readRaw(
        store,
        chunkKey(key, classified.generation, index),
      );
      if (part === null) {
        await deleteStored(key);
        return null;
      }
      parts.push(part);
    }
    const value = parts.join("");
    if (
      utf8Bytes(value) !== classified.bytes ||
      integrityDigest(value) !== classified.digest
    ) {
      await deleteStored(key);
      return null;
    }
    if (classified.previousGeneration !== null) {
      await deleteGeneration(store, key, classified.previousGeneration, false);
    }
    return value;
  }

  return {
    getItem(key) {
      return exclusive(key, () => readStored(key));
    },
    setItem(key, value) {
      return exclusive(key, () => writeStored(key, value));
    },
    removeItem(key) {
      return exclusive(key, () => deleteStored(key));
    },
  };
}
