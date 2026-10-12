import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  RECOVERY_PENDING_COOKIE,
  recoveryMarkerState,
} from "../../../lib/password-recovery";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { completePasswordRecovery } from "./actions";

export const dynamic = "force-dynamic";

type RecoveryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const recoveryErrors: Readonly<Record<string, string>> = {
  expired: "This recovery link is no longer valid. Request a new one.",
  mismatch: "Enter the same new password in both fields.",
  update: "The password could not be updated. Try again.",
};

export default async function PasswordRecoveryPage({
  searchParams,
}: RecoveryPageProps) {
  const marker = (await cookies()).get(RECOVERY_PENDING_COOKIE)?.value;
  if (recoveryMarkerState(marker) !== "active") {
    redirect("/?auth=recovery-expired");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) {
    redirect("/?auth=recovery-expired");
  }

  const params = await searchParams;
  const rawError = params["error"];
  const errorKey = Array.isArray(rawError) ? rawError[0] : rawError;
  const message = errorKey === undefined ? undefined : recoveryErrors[errorKey];

  return (
    <main className="recovery-page">
      <style>{`
        .recovery-page { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: #f5f6f2; color: #19231d; font-family: system-ui, sans-serif; }
        .recovery-card { width: min(100%, 28rem); display: grid; gap: 1rem; padding: 2rem; border: 1px solid #d8ded8; border-radius: 12px; background: white; }
        .recovery-card h1, .recovery-card p { margin: 0; }
        .recovery-form { display: grid; gap: 1rem; }
        .recovery-form label { display: grid; gap: .4rem; }
        .recovery-form input, .recovery-form button { min-height: 44px; padding: 0 .75rem; border: 1px solid #65736a; border-radius: 8px; font: inherit; }
        .recovery-form button { background: #efc95b; border-color: #efc95b; font-weight: 700; cursor: pointer; }
        .recovery-form :focus-visible { outline: 2px solid #1b6842; outline-offset: 2px; }
        .recovery-error { color: #8b1d1d; }
      `}</style>
      <section className="recovery-card" aria-labelledby="recovery-title">
        <p>The Stable</p>
        <h1 id="recovery-title">Choose a new password</h1>
        <p>
          This recovery session is short-lived. You will sign in again after
          updating your password.
        </p>
        {message === undefined ? null : (
          <p className="recovery-error" role="alert">
            {message}
          </p>
        )}
        <form action={completePasswordRecovery} className="recovery-form">
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
