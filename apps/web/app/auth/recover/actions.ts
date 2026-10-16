"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import {
  RECOVERY_PENDING_COOKIE,
  recoveryMarkerState,
} from "../../../lib/password-recovery";

export async function completePasswordRecovery(
  formData: FormData,
): Promise<void> {
  const cookieStore = await cookies();
  const marker = cookieStore.get(RECOVERY_PENDING_COOKIE)?.value;
  if (recoveryMarkerState(marker) !== "active") {
    redirect("/auth/recover?error=expired");
  }

  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    typeof confirmation !== "string" ||
    password !== confirmation
  ) {
    redirect("/auth/recover?error=mismatch");
  }

  const supabase = await createSupabaseServerClient();
  const userExists = await supabase.auth
    .getUser()
    .then(({ data, error }) => error === null && data.user !== null)
    .catch(() => false);
  if (!userExists) {
    redirect("/?auth=recovery-expired");
  }

  const updateSucceeded = await supabase.auth
    .updateUser({ password })
    .then(({ error }) => error === null)
    .catch(() => false);
  if (!updateSucceeded) {
    redirect("/auth/recover?error=update");
  }

  // Revoke the local recovery session after the credential changes. Clearing
  // the cookies also fails closed if the provider sign-out call is unavailable.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The browser session is cleared below regardless.
  }
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      cookieStore.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  cookieStore.set(RECOVERY_PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/?auth=recovered");
}
