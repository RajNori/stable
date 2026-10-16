import { collectNotificationReceipts } from "../../../packages/features/notifications/src/application/trusted-dispatch.ts";
import { createExpoProvider } from "../../../packages/features/notifications/src/infrastructure/expo-provider.ts";
import type { FetchLike } from "../../../packages/features/notifications/src/infrastructure/expo-provider.ts";
import {
  createTrustedDispatchStore,
  equalSecret,
  requiredEnvironment,
} from "../_shared/runtime.ts";

declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

export async function handleReceiptCollection(
  request: Request,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const expectedSecret = Deno.env.get("STABLE_PUSH_DISPATCH_SECRET");
  if (expectedSecret === undefined || expectedSecret.length === 0) {
    return json({ error: "Receipt collection is not configured." }, 503);
  }
  if (
    !equalSecret(
      request.headers.get("x-stable-push-dispatch-key"),
      expectedSecret,
    )
  ) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const store = createTrustedDispatchStore(
      requiredEnvironment("SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const provider = createExpoProvider(fetchWithTimeout);
    const summary = await collectNotificationReceipts(store, (receiptIds) =>
      provider.getReceipts(receiptIds),
    );
    return json({ result: "completed", ...summary }, 200);
  } catch {
    return json({ error: "Receipt collection could not be completed." }, 502);
  }
}

function fetchWithTimeout(
  input: string,
  init: Parameters<FetchLike>[1],
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(10_000) });
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

if (import.meta.main) Deno.serve(handleReceiptCollection);
