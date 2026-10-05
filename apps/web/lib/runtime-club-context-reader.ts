import type { ClubContextReader } from "@stable/contracts";

function isClubContextReader(value: unknown): value is ClubContextReader {
  if (typeof value !== "object" || value === null || !("read" in value)) {
    return false;
  }

  return typeof value.read === "function";
}

/**
 * Resolves the Supabase reader at runtime.
 * `lib/reader.ts` keeps the static import for typechecking. That export is not
 * on this branch yet, so the request path looks it up and fails closed.
 */
export async function createRuntimeClubContextReader(
  client: unknown,
): Promise<ClubContextReader> {
  const loaded: object = await import("@stable/current-club-context");
  const factory: unknown = Reflect.get(
    loaded,
    "createSupabaseClubContextReader",
  );

  if (typeof factory !== "function") {
    throw new Error(
      "createSupabaseClubContextReader is not exported from @stable/current-club-context.",
    );
  }

  const created: unknown = factory(client);
  if (!isClubContextReader(created)) {
    throw new Error("Club context reader is unavailable.");
  }

  return created;
}
