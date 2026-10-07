export type PushProviderResult = "OK" | "INVALID" | "ERROR";

export type ExpoPushMessage = {
  to: string;
  data: {
    notificationType: string;
    teamId: string;
    announcementId: string;
    category: string;
  };
};

export type ExpoPushPort = {
  send(message: ExpoPushMessage): Promise<PushProviderResult>;
};

export function createFakeExpoPushPort(input: {
  results: Record<string, PushProviderResult>;
}): ExpoPushPort & { sent: ExpoPushMessage[] } {
  const sent: ExpoPushMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve(input.results[message.to] ?? "ERROR");
    },
  };
}

export type DeliveryDevice = {
  token: string;
  active: boolean;
};

export type DeliveryPlan = {
  eligible: boolean;
  preferenceEnabled: boolean;
  alreadyDelivered: boolean;
  devices: readonly DeliveryDevice[];
  message: ExpoPushMessage;
};

export type DeliveryDecision = {
  status: "SENT" | "SKIPPED" | "FAILED" | "PENDING";
  deactivateTokens: string[];
  providerResults: { token: string; result: PushProviderResult }[];
};

export async function deliverQueuedNotification(
  plan: DeliveryPlan,
  port: ExpoPushPort,
): Promise<DeliveryDecision> {
  if (plan.alreadyDelivered) {
    return { status: "SENT", deactivateTokens: [], providerResults: [] };
  }
  if (!plan.eligible || !plan.preferenceEnabled) {
    return { status: "SKIPPED", deactivateTokens: [], providerResults: [] };
  }

  const active = plan.devices.filter((device) => device.active);
  if (active.length === 0) {
    return { status: "SKIPPED", deactivateTokens: [], providerResults: [] };
  }

  const deactivateTokens: string[] = [];
  const providerResults: { token: string; result: PushProviderResult }[] = [];
  for (const device of active) {
    const result = await port.send({
      to: device.token,
      data: plan.message.data,
    });
    providerResults.push({ token: device.token, result });
    if (result === "INVALID") {
      deactivateTokens.push(device.token);
    }
    if (result === "OK") {
      return { status: "SENT", deactivateTokens, providerResults };
    }
  }

  return { status: "FAILED", deactivateTokens, providerResults };
}

export function announcementPushData(input: {
  teamId: string;
  announcementId: string;
  category: string;
}): ExpoPushMessage["data"] {
  return {
    notificationType: "ANNOUNCEMENT_PUBLISHED",
    teamId: input.teamId,
    announcementId: input.announcementId,
    category: input.category,
  };
}
