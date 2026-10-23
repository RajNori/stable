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
  const hasMountedStepRef = useRef(false);

  useEffect(() => {
    setError(notice);
  }, [notice]);

  useEffect(() => {
    if (!hasMountedStepRef.current) {
      hasMountedStepRef.current = true;
      return;
    }

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
    "--sign-in-pad": `${theme.space[8]}px`,
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
    <div className="club-sign-in" style={frameStyle}>
      <style>{`
        .club-sign-in {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(18rem, 0.9fr) minmax(22rem, 1.1fr);
          background: var(--sign-in-canvas);
          color: var(--sign-in-ink);
        }
        .club-sign-in-brand,
        .club-sign-in-panel {
          padding: var(--sign-in-pad);
        }
        .club-sign-in-brand {
          background: var(--sign-in-inverse);
          color: var(--sign-in-inverse-ink);
          border-top: 4px solid var(--sign-in-gold);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1rem;
        }
        .club-sign-in-panel {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .club-sign-in-form {
          width: min(100%, 28rem);
          display: grid;
          gap: 1rem;
        }
        .club-sign-in h1 {
          margin: 0;
          font-size: ${theme.typeScale.headingLg.fontSize}px;
          line-height: ${theme.typeScale.headingLg.lineHeight}px;
          font-weight: ${theme.typeScale.headingLg.fontWeight};
        }
        .club-sign-in p { margin: 0; }
        .club-sign-in label {
          display: grid;
          gap: 0.4rem;
          font-size: ${theme.typeScale.labelMd.fontSize}px;
        }
        .club-sign-in input {
          min-height: 44px;
          padding: 0 0.8rem;
          border: 1px solid var(--sign-in-border);
          border-radius: var(--sign-in-radius);
          background: var(--sign-in-surface);
          color: var(--sign-in-ink);
          font-size: 1rem;
        }
        .club-sign-in button {
          min-height: 44px;
          min-width: 44px;
          border-radius: var(--sign-in-radius);
          font-size: 1rem;
          cursor: pointer;
        }
        .club-sign-in button:disabled { cursor: default; opacity: 0.7; }
        .club-sign-in button:focus-visible,
        .club-sign-in input:focus-visible {
          outline: 2px solid var(--sign-in-green);
          outline-offset: 2px;
        }
        .club-sign-in-primary {
          background: var(--sign-in-gold);
          color: var(--sign-in-ink);
          border: 1px solid var(--sign-in-gold);
          font-weight: 700;
        }
        .club-sign-in-secondary {
          background: transparent;
          color: var(--sign-in-green);
          border: 1px solid var(--sign-in-green);
        }
        .club-sign-in-text {
          background: transparent;
          color: var(--sign-in-green);
          border: 0;
          justify-self: start;
          padding: 0;
        }
        .club-sign-in-error {
          color: var(--sign-in-error);
          background: var(--sign-in-surface);
          padding: 0.75rem 1rem;
          border-radius: var(--sign-in-radius);
        }
        .club-sign-in-code {
          letter-spacing: 0.4rem;
          font-size: 1.25rem;
        }
        @media (max-width: 800px) {
          .club-sign-in { grid-template-columns: minmax(0, 1fr); }
          .club-sign-in-brand { min-height: 12rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .club-sign-in * { scroll-behavior: auto; }
        }
      `}</style>
      <section className="club-sign-in-brand" aria-label="The Stable">
        <p>The Stable</p>
        <h1>Know what&apos;s next. Show up ready.</h1>
        <p>
          Everything your basketball team needs for game day, training and the
          week ahead.
        </p>
      </section>
      <section className="club-sign-in-panel" aria-label="Sign in">
        {session.state === "loading" ? (
          <p role="status">Checking your session</p>
        ) : session.state === "recovery" ? (
          <form
            className="club-sign-in-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => actions.retry());
            }}
          >
            <h2>Sign-in is paused</h2>
            <p className="club-sign-in-error" role="alert">
              {session.message}
            </p>
            <button
              className="club-sign-in-primary"
              type="submit"
              disabled={busy}
            >
              Try again
            </button>
          </form>
        ) : (
          <form
            className="club-sign-in-form"
            onSubmit={(event) => {
              submitStep(event);
            }}
          >
            {session.state === "expired" ? (
              <p className="club-sign-in-error" role="alert">
                Your session has ended. Sign in again.
              </p>
            ) : null}
            {step.kind === "welcome" ? (
              <>
                <h2 ref={welcomeHeadingRef} tabIndex={-1}>
                  Sign in
                </h2>
                <button
                  className="club-sign-in-secondary"
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
                    className="club-sign-in-secondary"
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
                    className="club-sign-in-secondary"
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
                  className="club-sign-in-primary"
                  type="submit"
                  disabled={busy}
                >
                  Sign in
                </button>
                <button
                  className="club-sign-in-text"
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
                  className="club-sign-in-text"
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
                  className="club-sign-in-primary"
                  type="submit"
                  disabled={busy}
                >
                  Send recovery link
                </button>
                <button
                  className="club-sign-in-text"
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
                  className="club-sign-in-secondary"
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
              <p className="club-sign-in-error" role="alert">
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
