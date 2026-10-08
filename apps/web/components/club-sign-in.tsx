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

import { formatAustralianMobileInput } from "../lib/format-au-mobile";
import {
  frozenAuthProviderSettings,
  providerButtonReady,
  type AuthProviderSettings,
} from "../lib/provider-visibility";
import { safeAuthMessage } from "../lib/safe-auth-message";

const theme = themeFor("mustangs");

type Step =
  | { kind: "welcome" }
  | { kind: "phone" }
  | { kind: "phone-otp"; phone: string }
  | { kind: "email" }
  | { kind: "email-otp"; email: string };

export type ClubSignInActions = {
  requestPhone: (phone: string) => Promise<void>;
  verifyPhone: (phone: string, token: string) => Promise<void>;
  requestEmail: (email: string) => Promise<void>;
  verifyEmail: (email: string, token: string) => Promise<void>;
  retry: () => Promise<void>;
};

type ClubSignInProps = {
  readonly session: AuthSessionSnapshot;
  readonly actions: ClubSignInActions;
  readonly providerSettings?: AuthProviderSettings;
  readonly onProvider?: (provider: "google" | "apple") => void;
  readonly notice?: string | null;
  readonly resendCooldownSeconds?: number;
};

export function ClubSignIn({
  session,
  actions,
  providerSettings = frozenAuthProviderSettings(),
  onProvider,
  notice = null,
  resendCooldownSeconds = 30,
}: ClubSignInProps) {
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const welcomeHeadingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(notice);
  }, [notice]);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setResendIn((value) => value - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [resendIn]);

  useEffect(() => {
    if (step.kind === "welcome") {
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
  const startApple = providerButtonReady(providerSettings.apple, onProvider)
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
                  className="club-sign-in-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep({ kind: "phone" });
                    setError(null);
                  }}
                >
                  Continue with mobile
                </button>
                <button
                  className="club-sign-in-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep({ kind: "email" });
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
                      startGoogle("google");
                    }}
                  >
                    Continue with Google
                  </button>
                ) : null}
                {startApple !== undefined ? (
                  <button
                    className="club-sign-in-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      startApple("apple");
                    }}
                  >
                    Continue with Apple
                  </button>
                ) : null}
              </>
            ) : null}
            {step.kind === "phone" ? (
              <Field
                label="Mobile number"
                inputRef={inputRef}
                value={phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(value) => {
                  setPhone(formatAustralianMobileInput(value));
                }}
                submitLabel="Continue"
                busy={busy}
                onBack={() => {
                  setError(null);
                  setStep({ kind: "welcome" });
                }}
              />
            ) : null}
            {step.kind === "email" ? (
              <Field
                label="Email address"
                inputRef={inputRef}
                value={email}
                inputMode="email"
                autoComplete="email"
                onChange={(value) => {
                  setEmail(value.trimStart());
                }}
                submitLabel="Send code"
                busy={busy}
                hint="The same email can also sign you in from its link."
                onBack={() => {
                  setError(null);
                  setStep({ kind: "welcome" });
                }}
              />
            ) : null}
            {step.kind === "phone-otp" || step.kind === "email-otp" ? (
              <CodeField
                sentTo={step.kind === "phone-otp" ? step.phone : step.email}
                inputRef={inputRef}
                code={code}
                busy={busy}
                resendIn={resendIn}
                changeLabel={
                  step.kind === "phone-otp"
                    ? "Change mobile number"
                    : "Change email"
                }
                onCode={setCode}
                onChangeTarget={() => {
                  setCode("");
                  setError(null);
                  setStep(
                    step.kind === "phone-otp"
                      ? { kind: "phone" }
                      : { kind: "email" },
                  );
                }}
                onResend={() => {
                  void run(async () => {
                    if (step.kind === "phone-otp") {
                      await actions.requestPhone(step.phone);
                    } else {
                      await actions.requestEmail(step.email);
                    }
                    setResendIn(resendCooldownSeconds);
                  });
                }}
              />
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
    if (step.kind === "phone") {
      void run(async () => {
        await actions.requestPhone(phone);
        setStep({ kind: "phone-otp", phone });
        setCode("");
        setResendIn(resendCooldownSeconds);
      });
      return;
    }
    if (step.kind === "email") {
      const trimmed = email.trim();
      void run(async () => {
        await actions.requestEmail(trimmed);
        setEmail(trimmed);
        setStep({ kind: "email-otp", email: trimmed });
        setCode("");
        setResendIn(resendCooldownSeconds);
      });
      return;
    }
    if (step.kind === "phone-otp") {
      void run(async () => {
        await actions.verifyPhone(step.phone, code);
        setCode("");
      });
      return;
    }
    if (step.kind === "email-otp") {
      void run(async () => {
        await actions.verifyEmail(step.email, code);
        setCode("");
      });
    }
  }
}

function Field({
  label,
  inputRef,
  value,
  inputMode,
  autoComplete,
  onChange,
  submitLabel,
  busy,
  hint,
  onBack,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  inputMode: "tel" | "email";
  autoComplete: string;
  onChange: (value: string) => void;
  submitLabel: string;
  busy: boolean;
  hint?: string;
  onBack: () => void;
}) {
  return (
    <>
      <label>
        {label}
        <input
          ref={inputRef}
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </label>
      {hint === undefined ? null : <p>{hint}</p>}
      <button className="club-sign-in-primary" type="submit" disabled={busy}>
        {submitLabel}
      </button>
      <button className="club-sign-in-text" type="button" onClick={onBack}>
        Back
      </button>
    </>
  );
}

function CodeField({
  sentTo,
  inputRef,
  code,
  busy,
  resendIn,
  changeLabel,
  onCode,
  onChangeTarget,
  onResend,
}: {
  sentTo: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  code: string;
  busy: boolean;
  resendIn: number;
  changeLabel: string;
  onCode: (value: string) => void;
  onChangeTarget: () => void;
  onResend: () => void;
}) {
  const resendLabel =
    resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code";
  return (
    <>
      <p>Sent to {sentTo}</p>
      <label>
        6-digit code
        <input
          ref={inputRef}
          className="club-sign-in-code"
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          onChange={(event) => {
            onCode(event.target.value.replace(/\D/g, "").slice(0, 6));
          }}
        />
      </label>
      <button className="club-sign-in-primary" type="submit" disabled={busy}>
        Continue
      </button>
      <button
        className="club-sign-in-text"
        type="button"
        disabled={busy || resendIn > 0}
        onClick={onResend}
      >
        {resendLabel}
      </button>
      <button
        className="club-sign-in-text"
        type="button"
        onClick={onChangeTarget}
      >
        {changeLabel}
      </button>
    </>
  );
}
