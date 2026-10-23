import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { themeFor } from "@stable/design-tokens";

import {
  RECOVERY_PENDING_COOKIE,
  recoveryMarkerState,
} from "../../../lib/password-recovery";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { completePasswordRecovery } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type RecoveryPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const recoveryErrors: Readonly<Record<string, string>> = {
  expired: "This recovery link is no longer valid. Request a new one.",
  mismatch: "Enter the same new password in both fields.",
  update: "The password could not be updated. Try again.",
};

const theme = themeFor("mustangs");

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
  const themeStyle = {
    "--recovery-canvas": theme.color.background.canvas,
    "--recovery-surface": theme.color.background.surface,
    "--recovery-ink": theme.color.text.primary,
    "--recovery-secondary": theme.color.text.secondary,
    "--recovery-border": theme.color.border.default,
    "--recovery-brand": theme.color.brand.primary,
    "--recovery-accent": theme.color.brand.accent,
    "--recovery-inverse-ink": theme.color.text.inverse,
    "--recovery-error": theme.color.state.error,
    "--recovery-error-soft": theme.color.state.errorSoft,
    "--recovery-radius": `${theme.radius.md}px`,
  } as CSSProperties;

  return (
    <main className={styles.page} style={themeStyle}>
      <section className={styles.card} aria-labelledby="recovery-title">
        <span className={styles.mark} aria-hidden="true">
          S
        </span>
        <p className={styles.brand}>The Stable · Account security</p>
        <h1 id="recovery-title">Choose a new password</h1>
        <p className={styles.detail}>
          This recovery session is short-lived. You will sign in again after
          updating your password.
        </p>
        {message === undefined ? null : (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
        <form action={completePasswordRecovery} className={styles.form}>
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
