export type ExpoPushPayload = {
  to: string;
  title: "The Stable";
  body: string;
  sound: "default";
  data: { requestId: string; notificationType: string };
};

export type ExpoReceipt =
  { status: "ok" } | { status: "error"; errorCode?: string };

export type ExpoTicket =
  { status: "ok"; id: string } | { status: "error"; errorCode?: string };

export type FetchResponseLike = {
  ok: boolean;
  json(): Promise<unknown>;
};

export type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponseLike>;

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const SAFE_RECEIPT_ERRORS = new Set([
  "DeviceNotRegistered",
  "MessageTooBig",
  "MessageRateExceeded",
  "MismatchSenderId",
  "InvalidCredentials",
]);

export function createExpoProvider(fetcher: FetchLike) {
  return {
    async send(message: ExpoPushPayload): Promise<ExpoTicket> {
      const response = await fetcher(EXPO_PUSH_SEND_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(message),
      });
      const responseBody = await safeJson(response);
      if (!response.ok) return { status: "error" };

      const ticket = record(record(responseBody)?.data);
      if (ticket?.status === "ok" && isNonEmptyString(ticket.id)) {
        return { status: "ok", id: ticket.id };
      }
      const errorCode = providerErrorCode(ticket);
      return errorCode === undefined
        ? { status: "error" }
        : { status: "error", errorCode };
    },

    async getReceipts(
      receiptIds: readonly string[],
    ): Promise<Record<string, ExpoReceipt>> {
      const response = await fetcher(EXPO_PUSH_RECEIPTS_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ids: receiptIds }),
      });
      const responseBody = await safeJson(response);
      if (!response.ok) throw new Error("Expo receipt request failed.");

      const data = record(record(responseBody)?.data);
      const receipts: Record<string, ExpoReceipt> = {};
      for (const [receiptId, value] of Object.entries(data ?? {})) {
        const result = record(value);
        if (result?.status === "ok") {
          receipts[receiptId] = { status: "ok" };
        } else if (result?.status === "error") {
          const errorCode = providerErrorCode(result);
          receipts[receiptId] =
            errorCode === undefined
              ? { status: "error" }
              : { status: "error", errorCode };
        }
      }
      return receipts;
    },
  };
}

async function safeJson(response: FetchResponseLike): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function providerErrorCode(
  value: Record<string, unknown> | null,
): string | undefined {
  const details = record(value?.details);
  const code = details?.error;
  return typeof code === "string" && SAFE_RECEIPT_ERRORS.has(code)
    ? code
    : undefined;
}
