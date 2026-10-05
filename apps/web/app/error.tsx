"use client";

import { ClubAdminShell } from "../components/club-admin-shell";

export default function ClubContextError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ClubAdminShell
      presentation={{
        status: "error",
        message: "Club context could not be loaded.",
        nextStep:
          "Try again. If this continues, refresh the page in a few minutes.",
      }}
      onRetry={reset}
    />
  );
}
