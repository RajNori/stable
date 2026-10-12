import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import type {
  NotificationDispatchClaim,
  NotificationDispatchTarget,
  NotificationReceiptClaim,
  TrustedNotificationDispatchStore,
} from "../../../packages/features/notifications/src/application/trusted-dispatch.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
};

export function createTrustedDispatchStore(
  supabaseUrl: string,
  serviceRoleKey: string,
): TrustedNotificationDispatchStore {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await client.rpc(name, args);
    if (result.error !== null) {
      throw new Error("Notification dispatch persistence failed.");
    }
    return result.data as unknown;
  }

  return {
    async claimDispatches(limit: number) {
      const rows = rowsOf(
        await rpc("claim_notification_dispatches", {
          p_limit: limit,
        }),
      );
      return rows.map((row): NotificationDispatchClaim => ({
        requestId: requiredString(row, "request_id"),
        claimId: requiredString(row, "claim_id"),
        notificationType: requiredString(row, "notification_type"),
      }));
    },
    async beginDispatch(claim: NotificationDispatchClaim) {
      const row = rowsOf(
        await rpc("begin_notification_dispatch", {
          p_request_id: claim.requestId,
          p_claim_id: claim.claimId,
        }),
      )[0];
      if (row === undefined) return null;
      return {
        endpointId: requiredString(row, "endpoint_id"),
        pushToken: requiredString(row, "expo_push_token"),
        notificationType: requiredString(row, "notification_type"),
      } satisfies NotificationDispatchTarget;
    },
    async applyDispatchResult(input) {
      return requiredResult(
        await rpc("apply_expo_notification_result", {
          p_request_id: input.claim.requestId,
          p_claim_id: input.claim.claimId,
          p_endpoint_id: input.target.endpointId,
          p_result: input.result,
          p_provider_receipt_id: input.providerReceiptId ?? null,
          p_error_code: input.errorCode ?? null,
        }),
      );
    },
    async claimReceipts(limit: number) {
      const rows = rowsOf(
        await rpc("claim_notification_provider_receipts", {
          p_limit: limit,
        }),
      );
      return rows.map((row): NotificationReceiptClaim => ({
        providerReceiptId: requiredString(row, "provider_receipt_id"),
        endpointId: requiredString(row, "endpoint_id"),
      }));
    },
    async applyReceipt(input) {
      return requiredResult(
        await rpc("apply_notification_provider_receipt", {
          p_provider_receipt_id: input.receipt.providerReceiptId,
          p_status: input.status,
          p_error_code: input.errorCode ?? null,
        }),
      );
    },
  };
}

export function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0) {
    throw new Error("Dispatch environment is incomplete.");
  }
  return value;
}

export function equalSecret(
  provided: string | null,
  expected: string,
): boolean {
  const actual = provided ?? "";
  const length = Math.max(actual.length, expected.length);
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0 && expected.length > 0;
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error("Dispatch response was invalid.");
  }
  return value.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Dispatch response was invalid.");
  }
  return value;
}

function requiredResult(value: unknown): string {
  if (
    value !== "SENT" &&
    value !== "PENDING" &&
    value !== "SKIPPED" &&
    value !== "FAILED" &&
    value !== "OK" &&
    value !== "ERROR"
  ) {
    throw new Error("Dispatch response was invalid.");
  }
  return value;
}
