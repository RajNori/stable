import {
  SESSION_STORE_VALUE_BUDGET,
  createChunkedSessionStorage,
  type SecureSessionStore,
} from "./secure-session-store";

const storageKey = "sb-127-auth-token";
const secret = "secret-access-token";

describe("chunked session storage", () => {
  it("round-trips a session larger than one SecureStore value", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    const session = JSON.stringify({
      access_token: secret,
      refresh_token: "secret-refresh-token",
      user: { id: "adult", note: "x".repeat(4000) },
    });

    await storage.setItem(storageKey, session);

    expect(await storage.getItem(storageKey)).toBe(session);
    expect(backing.maxBytes).toBeLessThanOrEqual(SESSION_STORE_VALUE_BUDGET);
    expect(backing.values.get(storageKey) ?? "").not.toContain(secret);
    expect([...backing.values.keys()].length).toBeGreaterThan(1);
  });

  it("migrates a legacy single-value session without leaving it on the primary key", async () => {
    const backing = memoryStore();
    const legacy = JSON.stringify({
      access_token: secret,
      refresh_token: "secret-refresh-token",
    });
    backing.values.set(storageKey, legacy);
    const storage = createChunkedSessionStorage(backing.store);

    expect(await storage.getItem(storageKey)).toBe(legacy);
    expect(backing.values.get(storageKey) ?? "").not.toContain(secret);
    expect(await storage.getItem(storageKey)).toBe(legacy);
  });

  it("drops an interrupted write and keeps the previous session", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "current-session");
    backing.values.set(
      `${storageKey}.writing`,
      JSON.stringify({ generation: "abc123", count: 1 }),
    );
    backing.values.set(`${storageKey}.abc123.0`, secret);

    expect(await storage.getItem(storageKey)).toBe("current-session");
    expect(backing.values.has(`${storageKey}.writing`)).toBe(false);
    expect(backing.values.has(`${storageKey}.abc123.0`)).toBe(false);
    expect([...backing.values.values()].join("")).not.toContain(secret);
  });

  it("cleans an invalid write marker before returning an absent value", async () => {
    const backing = memoryStore();
    backing.values.set(`${storageKey}.writing`, "{not-json");
    const storage = createChunkedSessionStorage(backing.store);

    expect(await storage.getItem(storageKey)).toBeNull();
    expect(backing.values.has(`${storageKey}.writing`)).toBe(false);
  });

  it("cleans a marker already represented by the committed manifest", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "saved-session");
    const manifest = JSON.parse(backing.values.get(storageKey) ?? "{}") as {
      generation: string;
      count: number;
    };
    backing.values.set(
      `${storageKey}.writing`,
      JSON.stringify({
        generation: manifest.generation,
        count: manifest.count,
      }),
    );

    expect(await storage.getItem(storageKey)).toBe("saved-session");
    expect(backing.values.has(`${storageKey}.writing`)).toBe(false);
  });

  it("stores an empty session as a valid zero-chunk record", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);

    await storage.setItem(storageKey, "");

    expect(await storage.getItem(storageKey)).toBe("");
    expect(JSON.parse(backing.values.get(storageKey) ?? "{}")).toMatchObject({
      count: 0,
      bytes: 0,
      previousGeneration: null,
    });
  });

  it("clears a corrupt manifest and a digest mismatch", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "current-session");
    const manifest = JSON.parse(backing.values.get(storageKey) ?? "{}") as {
      digest: string;
    };
    manifest.digest = "0000000000000000";
    backing.values.set(storageKey, JSON.stringify(manifest));

    expect(await storage.getItem(storageKey)).toBeNull();
    expect(backing.values.has(storageKey)).toBe(false);

    backing.values.set(
      storageKey,
      JSON.stringify({
        kind: "stable-auth-chunks",
        version: 2,
        generation: "abc123",
      }),
    );
    backing.values.set(`${storageKey}.abc123.0`, secret);
    expect(await storage.getItem(storageKey)).toBeNull();
    expect(backing.values.has(`${storageKey}.abc123.0`)).toBe(false);
    expect([...backing.values.values()].join("")).not.toContain(secret);
  });

  it("clears a manifest whose chunk is missing", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "y".repeat(4000));
    const chunk = [...backing.values.keys()].find((key) =>
      key.startsWith(`${storageKey}.`),
    );
    expect(chunk).toBeDefined();
    if (chunk !== undefined) {
      backing.values.delete(chunk);
    }

    expect(await storage.getItem(storageKey)).toBeNull();
    expect(backing.values.has(storageKey)).toBe(false);
  });

  it("does not replace the previous session when a chunk write fails", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "current-session");
    backing.failValue = secret;

    await expect(storage.setItem(storageKey, secret)).rejects.toThrow(
      "The session could not be stored.",
    );
    expect(await storage.getItem(storageKey)).toBe("current-session");
    expect([...backing.values.values()].join("")).not.toContain(secret);
  });

  it("reports a read failure without echoing the stored value", async () => {
    const backing = memoryStore();
    backing.readError = `platform read ${secret}`;
    const storage = createChunkedSessionStorage(backing.store);

    await expect(storage.getItem(storageKey)).rejects.toThrow(
      "The session could not be read.",
    );
  });

  it("reports a delete failure without echoing the stored value", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "current-session");
    backing.deleteError = `platform delete ${secret}`;

    await expect(storage.removeItem(storageKey)).rejects.toThrow(
      "The session could not be removed.",
    );
  });

  it("removes chunks, the writing marker, and the manifest", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "y".repeat(4000));

    await storage.removeItem(storageKey);

    expect(backing.values.size).toBe(0);
    expect(await storage.getItem(storageKey)).toBeNull();
  });

  it("removes both generations when a previous session is still referenced", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    await storage.setItem(storageKey, "older-session");
    const previous = JSON.parse(backing.values.get(storageKey) ?? "{}") as {
      generation: string;
    };
    await storage.setItem(storageKey, "newer-session");
    const current = JSON.parse(backing.values.get(storageKey) ?? "{}") as {
      generation: string;
      previousGeneration: string;
    };
    expect(current.previousGeneration).toBe(previous.generation);

    await storage.removeItem(storageKey);

    expect(backing.values.size).toBe(0);
  });

  it("refuses a payload that exceeds the chunk budget", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    const oversized = "z".repeat(60_000);

    await expect(storage.setItem(storageKey, oversized)).rejects.toThrow(
      "The session could not be stored.",
    );
    expect(backing.values.size).toBe(0);
  });

  it("applies queued writes in order", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);

    await Promise.all([
      storage.setItem(storageKey, "first"),
      storage.setItem(storageKey, "second"),
    ]);

    expect(await storage.getItem(storageKey)).toBe("second");
  });

  it("round-trips unicode across chunk boundaries and cleans the prior generation", async () => {
    const backing = memoryStore();
    const storage = createChunkedSessionStorage(backing.store);
    const first = "🟠é漢".repeat(700);
    const second = "🏀ø漢".repeat(740);
    await storage.setItem(storageKey, first);
    const firstManifest = JSON.parse(
      backing.values.get(storageKey) ?? "{}",
    ) as { generation: string };

    await storage.setItem(storageKey, second);
    expect(await storage.getItem(storageKey)).toBe(second);
    expect(
      [...backing.values.keys()].some((key) =>
        key.startsWith(`${storageKey}.${firstManifest.generation}.`),
      ),
    ).toBe(false);
    expect(backing.maxBytes).toBeLessThanOrEqual(SESSION_STORE_VALUE_BUDGET);
  });
});

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

function memoryStore(): {
  store: SecureSessionStore;
  values: Map<string, string>;
  maxBytes: number;
  failValue: string | null;
  readError: string | null;
  deleteError: string | null;
} {
  const values = new Map<string, string>();
  const state = {
    maxBytes: 0,
    failValue: null as string | null,
    readError: null as string | null,
    deleteError: null as string | null,
  };
  return {
    values,
    get maxBytes() {
      return state.maxBytes;
    },
    set failValue(value: string | null) {
      state.failValue = value;
    },
    get failValue() {
      return state.failValue;
    },
    set readError(value: string | null) {
      state.readError = value;
    },
    get readError() {
      return state.readError;
    },
    set deleteError(value: string | null) {
      state.deleteError = value;
    },
    get deleteError() {
      return state.deleteError;
    },
    store: {
      async getItemAsync(key) {
        if (state.readError !== null) {
          throw new Error(state.readError);
        }
        return values.get(key) ?? null;
      },
      async setItemAsync(key, value) {
        if (state.failValue !== null && value.includes(state.failValue)) {
          throw new Error(`rejected ${value}`);
        }
        const bytes = utf8Bytes(value);
        state.maxBytes = Math.max(state.maxBytes, bytes);
        values.set(key, value);
      },
      async deleteItemAsync(key) {
        if (state.deleteError !== null) {
          throw new Error(state.deleteError);
        }
        values.delete(key);
      },
    },
  };
}
