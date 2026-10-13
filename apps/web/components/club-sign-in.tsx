"use client";

import type { AuthSessionSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import {
  frozenAuthProviderSettings,
  providerButtonReady,
  type AuthProviderSettings,
} from "../lib/provider-visibility";
import { safeAuthMessage } from "../lib/safe-auth-message";
import styles from "./club-sign-in.module.css";

const theme = themeFor("mustangs");

type Step =
  | { kind: "welcome" }
  | { kind: "password" }
  | { kind: "recovery" }
  | { kind: "recovery-sent" };

export type ClubSignInActions = {
  signInPassword: (email: string, password: string) => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  retry: () => Promise<void>;
};

type ClubSignInProps = {
  readonly session: AuthSessionSnapshot;
  readonly actions: ClubSignInActions;
  readonly providerSettings?: AuthProviderSettings;
  readonly onProvider?: (provider: "google" | "facebook") => Promise<void>;
  readonly notice?: string | null;
};

export function ClubSignIn({
  session,
  actions,
  providerSettings = frozenAuthProviderSettings(),
  onProvider,
  notice = null,
}: ClubSignInProps) {
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const welcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(notice);
  }, [notice]);

  useEffect(() => {
    if (step.kind === "welcome" || step.kind === "recovery-sent") {
      welcomeHeadingRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [step.kind]);

  if (session.state === "authenticated") {
    return null;
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(safeAuthMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const frameStyle = {
    "--sign-in-canvas": theme.color.background.canvas,
    "--sign-in-ink": theme.color.text.primary,
    "--sign-in-muted": theme.color.text.secondary,
    "--sign-in-inverse": theme.color.background.inverse,
    "--sign-in-inverse-ink": theme.color.text.inverse,
    "--sign-in-green": theme.color.brand.primary,
    "--sign-in-gold": theme.color.brand.accent,
    "--sign-in-surface": theme.color.background.surface,
    "--sign-in-border": theme.color.border.default,
    "--sign-in-error": theme.color.state.error,
    "--sign-in-radius": `${theme.radius.md}px`,
  } as CSSProperties;

  const startGoogle = providerButtonReady(providerSettings.google, onProvider)
    ? onProvider
    : undefined;
  const startFacebook = providerButtonReady(
    providerSettings.facebook,
    onProvider,
  )
    ? onProvider
    : undefined;

  return (
    <div className={styles.root} style={frameStyle}>
      <section className={styles.brand} aria-label="The Stable">
        <span className={styles.brandMark} aria-hidden="true">
          S
        </span>
        <p className={styles.brandName}>The Stable</p>
        <h1>
          Know what&apos;s next.
          <br />
          Show up ready.
        </h1>
        <p className={styles.brandDetail}>
          Everything your basketball team needs for game day, training and the
          week ahead.
        </p>
      </section>
      <section className={styles.panel} aria-label="Sign in">
        {session.state === "loading" ? (
          <p className={styles.loading} role="status">
            Checking your session
          </p>
        ) : session.state === "recovery" ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => actions.retry());
            }}
          >
            <h2>Sign-in is paused</h2>
            <p className={styles.error} role="alert">
              {session.message}
            </p>
            <button className={styles.primary} type="submit" disabled={busy}>
              Try again
            </button>
          </form>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              submitStep(event);
            }}
          >
            {session.state === "expired" ? (
              <p className={styles.error} role="alert">
                Your session has ended. Sign in again.
              </p>
            ) : null}
            {step.kind === "welcome" ? (
              <>
                <h2 ref={welcomeHeadingRef} tabIndex={-1}>
                  Sign in
                </h2>
                <button
                  className={styles.secondary}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep({ kind: "password" });
                    setError(null);
                  }}
                >
                  Continue with email
                </button>
                {startGoogle !== undefined ? (
                  <button
                    className={styles.secondary}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void run(() => startGoogle("google"));
                    }}
                  >
                    Continue with Google
                  </button>
                ) : null}
                {startFacebook !== undefined ? (
                  <button
                    className={styles.secondary}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void run(() => startFacebook("facebook"));
                    }}
                  >
                    Continue with Facebook
                  </button>
                ) : null}
              </>
            ) : null}
            {step.kind === "password" ? (
              <>
                <label>
                  Email address
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    inputMode="email"
                    autoComplete="username"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button
                  className={styles.primary}
                  type="submit"
                  disabled={busy}
                >
                  Sign in
                </button>
                <button
                  className={styles.textButton}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setStep({ kind: "recovery" });
                  }}
                >
                  Forgot password?
                </button>
                <button
                  className={styles.textButton}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep({ kind: "welcome" });
                  }}
                >
                  Back
                </button>
              </>
            ) : null}
            {step.kind === "recovery" ? (
              <>
                <h2 ref={welcomeHeadingRef} tabIndex={-1}>
                  Reset your password
                </h2>
                <p>
                  Enter your email address. If an account can sign in with that
                  address, we&apos;ll send a recovery link.
                </p>
                <label>
                  Email address
                  <input
                    ref={inputRef}
                    type="email"
                    value={email}
                    inputMode="email"
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <button
                  className={styles.primary}
                  type="submit"
                  disabled={busy}
                >
                  Send recovery link
                </button>
                <button
                  className={styles.textButton}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setStep({ kind: "password" });
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : null}
            {step.kind === "recovery-sent" ? (
              <>
                <h2 ref={welcomeHeadingRef} tabIndex={-1}>
                  Check your inbox
                </h2>
                <p role="status">
                  If an account can sign in with that address, we&apos;ll send a
                  recovery link. Follow it to choose a new password.
                </p>
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep({ kind: "password" });
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : null}
            {error === null ? null : (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );

  function submitStep(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(async () => {
      if (step.kind === "recovery") {
        await actions.requestPasswordRecovery(email.trim());
        setPassword("");
        setStep({ kind: "recovery-sent" });
        return;
      }
      if (step.kind === "password") {
        await actions.signInPassword(email.trim(), password);
        setPassword("");
      }
    });
  }
}
