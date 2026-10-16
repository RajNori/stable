export type NotificationDispatchClaim = {
  requestId: string;
  claimId: string;
  notificationType: string;
};

export type NotificationDispatchTarget = {
  endpointId: string;
  pushToken: string;
  notificationType: string;
};

export type NotificationReceiptClaim = {
  providerReceiptId: string;
  endpointId: string;
  claimId: string;
};

export type ExpoTicket =
  { status: "ok"; id: string } | { status: "error"; errorCode?: string };

export type ExpoReceipt =
  { status: "ok" } | { status: "error"; errorCode?: string };

export type ExpoPushPayload = {
  to: string;
  title: "The Stable";
  body: string;
  sound: "default";
  data: {
    requestId: string;
    notificationType: string;
  };
};

export interface TrustedNotificationDispatchStore {
  claimDispatches(limit: number): Promise<NotificationDispatchClaim[]>;
  beginDispatch(
    claim: NotificationDispatchClaim,
  ): Promise<NotificationDispatchTarget | null>;
  applyDispatchResult(input: {
    claim: NotificationDispatchClaim;
    target: NotificationDispatchTarget;
    result: "OK" | "INVALID" | "ERROR";
    providerReceiptId?: string;
    errorCode?: string;
  }): Promise<string>;
  claimReceipts(limit: number): Promise<NotificationReceiptClaim[]>;
  applyReceipt(input: {
    receipt: NotificationReceiptClaim;
    status: "PENDING" | "OK" | "ERROR";
    errorCode?: string;
  }): Promise<string>;
}

export type NotificationDispatchSummary = {
  claimed: number;
  attempted: number;
  sent: number;
  pending: number;
  skipped: number;
  failed: number;
};

export function createPrivacySafeExpoMessage(input: {
  requestId: string;
  notificationType: string;
  pushToken: string;
}): ExpoPushPayload {
  return {
    to: input.pushToken,
    title: "The Stable",
    body: safeBody(input.notificationType),
    sound: "default",
    data: {
      requestId: input.requestId,
      notificationType: input.notificationType,
    },
  };
}

export async function dispatchNotificationBatch(
  store: TrustedNotificationDispatchStore,
  send: (message: ExpoPushPayload) => Promise<ExpoTicket>,
  limit = 25,
): Promise<NotificationDispatchSummary> {
  const claims = await store.claimDispatches(limit);
  const summary: NotificationDispatchSummary = {
    claimed: claims.length,
    attempted: 0,
    sent: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
  };

  for (const claim of claims) {
    const target = await store.beginDispatch(claim);
    if (target === null) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    let ticket: ExpoTicket;
    try {
      ticket = await send(
        createPrivacySafeExpoMessage({
          requestId: claim.requestId,
          notificationType: claim.notificationType,
          pushToken: target.pushToken,
        }),
      );
    } catch {
      ticket = { status: "error" };
    }

    if (ticket.status === "ok") {
      const state = await store.applyDispatchResult({
        claim,
        target,
        result: "OK",
        providerReceiptId: ticket.id,
      });
      if (state === "SENT") summary.sent += 1;
      else if (state === "SKIPPED") summary.skipped += 1;
      else summary.failed += 1;
      continue;
    }

    const invalid = ticket.errorCode === "DeviceNotRegistered";
    const state = await store.applyDispatchResult({
      claim,
      target,
      result: invalid ? "INVALID" : "ERROR",
      ...(ticket.errorCode === undefined
        ? {}
        : { errorCode: ticket.errorCode }),
    });
    if (state === "PENDING") summary.pending += 1;
    else if (state === "SKIPPED") summary.skipped += 1;
    else summary.failed += 1;
  }

  return summary;
}

export async function collectNotificationReceipts(
  store: TrustedNotificationDispatchStore,
  fetchReceipts: (
    receiptIds: readonly string[],
  ) => Promise<Record<string, ExpoReceipt>>,
  limit = 100,
): Promise<{
  claimed: number;
  checked: number;
  pending: number;
  errors: number;
}> {
  const receipts = await store.claimReceipts(limit);
  if (receipts.length === 0) {
    return { claimed: 0, checked: 0, pending: 0, errors: 0 };
  }

  const results = await fetchReceipts(
    receipts.map((receipt) => receipt.providerReceiptId),
  );
  const summary = {
    claimed: receipts.length,
    checked: 0,
    pending: 0,
    errors: 0,
  };

  for (const receipt of receipts) {
    const result = results[receipt.providerReceiptId];
    if (result === undefined) {
      summary.pending += 1;
      continue;
    }
    const status = result.status === "ok" ? "OK" : "ERROR";
    await store.applyReceipt({
      receipt,
      status,
      ...(result.status === "error" && result.errorCode !== undefined
        ? { errorCode: result.errorCode }
        : {}),
    });
    summary.checked += 1;
    if (status === "ERROR") summary.errors += 1;
  }

  return summary;
}

function safeBody(notificationType: string): string {
  switch (notificationType) {
    case "ANNOUNCEMENT_PUBLISHED":
      return "A team update is available.";
    case "DUTY_ASSIGNED":
    case "DUTY_SWAP_REQUESTED":
    case "DUTY_SWAP_ACCEPTED":
      return "There is an update to a team duty.";
    case "FILL_IN_REQUESTED":
      return "A fill-in opportunity is available.";
    case "FILL_IN_CONFIRMED":
      return "A fill-in response was confirmed.";
    case "TRAINING_CHANGED":
    case "TRAINING_CANCELLED":
      return "There is an update to a team training session.";
    case "COACH_CHECKED_IN":
      return "A coach checked in.";
    case "FIXTURE_CHANGED":
    case "GAME_REMINDER":
    case "RSVP_REQUIRED":
    default:
      return "There is an update to a team event.";
  }
}
