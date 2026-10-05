import type { EvaluateCapability } from "@stable/contracts";

export type {
  Capability,
  CapabilityDecision,
  EvaluateCapability,
  MembershipFact,
} from "@stable/contracts";

/** Fail closed until the auth workstream replaces this with the real evaluator. */
export const evaluateCapability: EvaluateCapability = () => "deny";
