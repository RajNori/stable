import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  type Principal,
} from "@stable/contracts";

import { normalizeAustralianMobile } from "./australian-mobile.js";
import { decideIdentityLink } from "./identity-link-policy.js";

/**
 * Phone credential changes stay closed. This operation has no provider gateway.
 */
export async function requestPhoneCredentialChange(input: {
  principal: Principal | null;
  phone: string;
}): Promise<never> {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      AUTH_ERROR_MESSAGES.UNAUTHENTICATED,
    );
  }
  normalizeAustralianMobile(input.phone);
  const decision = decideIdentityLink({
    kind: "phone_change",
    authenticated: true,
    candidateOwnedByOtherUser: false,
    phoneNormalized: true,
    phoneChangeState: "clear",
    verificationCompleted: true,
  });
  if (decision.application === "refuse") {
    throw new ApplicationError(
      decision.errorCode,
      AUTH_ERROR_MESSAGES[decision.errorCode],
    );
  }
  throw new ApplicationError("CONFLICT", AUTH_ERROR_MESSAGES.CONFLICT);
}
