import { ApplicationError } from "@stable/contracts";
import type { GetCurrentClubContextInput } from "@stable/contracts";
import { getCurrentClubContext } from "@stable/current-club-context";

import type { ClubContextPresentation } from "./club-context-presentation";

const UNAUTHENTICATED_NEXT_STEP =
  "Sign in with the email address your club used to invite you.";
const NO_MEMBERSHIP_MESSAGE = "You do not have an active club membership.";
const NO_MEMBERSHIP_NEXT_STEP =
  "Ask a club administrator to add you to a club, then refresh this page.";
const ERROR_NEXT_STEP =
  "Refresh this page. If club context still does not load, try again in a few minutes.";
const UNKNOWN_ERROR_MESSAGE = "Club context could not be loaded.";

export async function loadClubContext(
  input: GetCurrentClubContextInput,
): Promise<ClubContextPresentation> {
  try {
    const context = await getCurrentClubContext({
      principal: input.principal,
      reader: input.reader,
    });
    if (context.club === null) {
      return {
        status: "no-membership",
        displayName: context.displayName,
        message: NO_MEMBERSHIP_MESSAGE,
        nextStep: NO_MEMBERSHIP_NEXT_STEP,
      };
    }

    return {
      status: "member",
      clubName: context.club.name,
      displayName: context.displayName,
      capabilities: context.capabilities,
    };
  } catch (error: unknown) {
    return presentClubContextFailure(error);
  }
}

export function presentClubContextFailure(
  error: unknown,
): ClubContextPresentation {
  if (error instanceof ApplicationError && error.code === "UNAUTHENTICATED") {
    return {
      status: "unauthenticated",
      message: error.message,
      nextStep: UNAUTHENTICATED_NEXT_STEP,
    };
  }

  if (error instanceof ApplicationError) {
    return {
      status: "error",
      message: error.message,
      nextStep: ERROR_NEXT_STEP,
    };
  }

  return {
    status: "error",
    message: UNKNOWN_ERROR_MESSAGE,
    nextStep: ERROR_NEXT_STEP,
  };
}
