import type { Capability } from "@stable/contracts";

export type ClubContextPresentation =
  | { status: "loading" }
  | {
      status: "unauthenticated";
      message: string;
      nextStep: string;
    }
  | {
      status: "no-membership";
      displayName: string;
      message: string;
      nextStep: string;
    }
  | {
      status: "member";
      clubName: string;
      displayName: string;
      capabilities: readonly Capability[];
    }
  | {
      status: "error";
      message: string;
      nextStep: string;
    };
