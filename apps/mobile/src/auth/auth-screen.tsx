import type { AuthSessionSnapshot } from "@stable/contracts";
import { themeFor } from "@stable/design-tokens";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { formatAustralianMobileInput } from "./format-au-mobile";
import {
  frozenAuthProviderSettings,
  providerButtonReady,
  type AuthProviderName,
  type AuthProviderSettings,
} from "./provider-visibility";
import { safeAuthMessage } from "./safe-auth-message";

const theme = themeFor("mustangs");
const MIN_TOUCH = 44;

export type AuthActions = {
  requestPhone: (phone: string) => Promise<void>;
  verifyPhone: (phone: string, token: string) => Promise<void>;
  requestEmail: (email: string) => Promise<void>;
  verifyEmail: (email: string, token: string) => Promise<void>;
  retry: () => Promise<void>;
};

type Step =
  | { readonly kind: "welcome" }
  | { readonly kind: "phone" }
  | { readonly kind: "phone-otp"; readonly phone: string }
  | { readonly kind: "email" }
  | { readonly kind: "email-otp"; readonly email: string };

type AuthScreenProps = {
  readonly session: AuthSessionSnapshot;
  readonly actions: AuthActions;
  readonly providerSettings?: AuthProviderSettings;
  readonly onProvider?: (provider: AuthProviderName) => void;
  readonly resendCooldownSeconds?: number;
  readonly accessibilityFocusTarget?: (heading: Text | null) => number | null;
};

export function AuthScreen({
  session,
  actions,
  providerSettings = frozenAuthProviderSettings(),
  onProvider,
  resendCooldownSeconds = 30,
  accessibilityFocusTarget = findNodeHandle,
}: AuthScreenProps) {
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const headingRef = useRef<Text>(null);
  const announcement =
    session.state === "recovery"
      ? `Sign-in is paused. ${session.message}`
      : session.state === "loading" || session.state === "authenticated"
        ? null
        : step.kind === "welcome"
          ? "Know what's next. Show up ready."
          : step.kind === "phone"
            ? "Your mobile"
            : step.kind === "email"
              ? "Your email"
              : `Enter the code. Sent to ${step.kind === "phone-otp" ? step.phone : step.email}`;

  useEffect(() => {
    if (announcement !== null) {
      AccessibilityInfo.announceForAccessibility(announcement);
    }
  }, [announcement]);

  useEffect(() => {
    if (announcement === null) {
      return;
    }
    let active = true;
    const screenReaderStatus = AccessibilityInfo.isScreenReaderEnabled?.();
    if (screenReaderStatus === undefined) {
      return;
    }
    void screenReaderStatus
      .then((enabled) => {
        if (!active || !enabled) {
          return;
        }
        const target = accessibilityFocusTarget(headingRef.current);
        if (target !== null) {
          AccessibilityInfo.setAccessibilityFocus(target);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessibilityFocusTarget, announcement]);

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

  if (session.state === "authenticated") {
    return null;
  }

  if (session.state === "loading") {
    return (
      <View style={styles.screen} accessibilityRole="progressbar">
        <Text style={styles.brand}>The Stable</Text>
        <Text style={styles.body}>Checking your session</Text>
      </View>
    );
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

  function beginCooldown(): void {
    setResendIn(resendCooldownSeconds);
  }

  if (session.state === "recovery") {
    return (
      <View style={styles.screen}>
        <Text style={styles.brand}>The Stable</Text>
        <Text
          ref={headingRef}
          accessibilityRole="header"
          style={styles.heading}
        >
          Sign-in is paused
        </Text>
        <Text accessibilityRole="alert" style={styles.error}>
          {session.message}
        </Text>
        <PrimaryButton
          label="Try again"
          disabled={busy}
          onPress={() => {
            void run(() => actions.retry());
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.screen}
      >
        {session.state === "expired" ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Your session has ended. Sign in again.
          </Text>
        ) : null}
        {step.kind === "welcome" ? (
          <Welcome
            headingRef={headingRef}
            providerSettings={providerSettings}
            busy={busy}
            onPhone={() => {
              setError(null);
              setStep({ kind: "phone" });
            }}
            onEmail={() => {
              setError(null);
              setStep({ kind: "email" });
            }}
            onProvider={onProvider}
          />
        ) : null}
        {step.kind === "phone" ? (
          <Entry
            headingRef={headingRef}
            title="Your mobile"
            hint="Australian mobiles start with 04."
            label="Mobile number"
            value={phone}
            keyboard="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            busy={busy}
            error={error}
            submitLabel="Continue"
            onChange={(value) => {
              setPhone(formatAustralianMobileInput(value));
            }}
            onBack={() => {
              setError(null);
              setStep({ kind: "welcome" });
            }}
            onSubmit={() => {
              void run(async () => {
                await actions.requestPhone(phone);
                setCode("");
                beginCooldown();
                setStep({ kind: "phone-otp", phone });
              });
            }}
          />
        ) : null}
        {step.kind === "phone-otp" ? (
          <CodeEntry
            headingRef={headingRef}
            title="Enter the code"
            sentTo={step.phone}
            changeLabel="Change mobile number"
            code={code}
            busy={busy}
            error={error}
            resendIn={resendIn}
            autoComplete="sms-otp"
            onChange={setCode}
            onBack={() => {
              setError(null);
              setCode("");
              setStep({ kind: "phone" });
            }}
            onResend={() => {
              void run(async () => {
                await actions.requestPhone(step.phone);
                beginCooldown();
              });
            }}
            onSubmit={() => {
              void run(async () => {
                await actions.verifyPhone(step.phone, code);
                setCode("");
              });
            }}
          />
        ) : null}
        {step.kind === "email" ? (
          <Entry
            headingRef={headingRef}
            title="Your email"
            hint="We'll send a 6-digit code. The same email can also sign you in from its link."
            label="Email address"
            value={email}
            keyboard="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            busy={busy}
            error={error}
            submitLabel="Send code"
            onChange={(value) => {
              setEmail(value.trimStart());
            }}
            onBack={() => {
              setError(null);
              setStep({ kind: "welcome" });
            }}
            onSubmit={() => {
              void run(async () => {
                const trimmed = email.trim();
                await actions.requestEmail(trimmed);
                setEmail(trimmed);
                setCode("");
                beginCooldown();
                setStep({ kind: "email-otp", email: trimmed });
              });
            }}
          />
        ) : null}
        {step.kind === "email-otp" ? (
          <CodeEntry
            headingRef={headingRef}
            title="Enter the code"
            sentTo={step.email}
            changeLabel="Change email"
            code={code}
            busy={busy}
            error={error}
            resendIn={resendIn}
            autoComplete="one-time-code"
            onChange={setCode}
            onBack={() => {
              setError(null);
              setCode("");
              setStep({ kind: "email" });
            }}
            onResend={() => {
              void run(async () => {
                await actions.requestEmail(step.email);
                beginCooldown();
              });
            }}
            onSubmit={() => {
              void run(async () => {
                await actions.verifyEmail(step.email, code);
                setCode("");
              });
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Welcome({
  headingRef,
  providerSettings,
  busy,
  onPhone,
  onEmail,
  onProvider,
}: {
  headingRef: React.RefObject<Text | null>;
  providerSettings: AuthProviderSettings;
  busy: boolean;
  onPhone: () => void;
  onEmail: () => void;
  onProvider: ((provider: AuthProviderName) => void) | undefined;
}) {
  const startGoogle = providerButtonReady(providerSettings.google, onProvider)
    ? onProvider
    : undefined;
  const startApple = providerButtonReady(providerSettings.apple, onProvider)
    ? onProvider
    : undefined;

  return (
    <View style={styles.stack}>
      <Text style={styles.brand}>The Stable</Text>
      <Text ref={headingRef} accessibilityRole="header" style={styles.heading}>
        Know what's next. Show up ready.
      </Text>
      <Text style={styles.body}>
        Everything your basketball team needs for game day, training and the
        week ahead.
      </Text>
      <PrimaryButton
        label="Continue with mobile"
        disabled={busy}
        onPress={onPhone}
      />
      <SecondaryButton
        label="Continue with email"
        disabled={busy}
        onPress={onEmail}
      />
      {startGoogle !== undefined ? (
        <SecondaryButton
          label="Continue with Google"
          disabled={busy}
          onPress={() => {
            startGoogle("google");
          }}
        />
      ) : null}
      {startApple !== undefined ? (
        <SecondaryButton
          label="Continue with Apple"
          disabled={busy}
          onPress={() => {
            startApple("apple");
          }}
        />
      ) : null}
    </View>
  );
}

function Entry({
  headingRef,
  title,
  hint,
  label,
  value,
  keyboard,
  autoComplete,
  textContentType,
  busy,
  error,
  submitLabel,
  onChange,
  onBack,
  onSubmit,
}: {
  headingRef: React.RefObject<Text | null>;
  title: string;
  hint: string;
  label: string;
  value: string;
  keyboard: "phone-pad" | "email-address";
  autoComplete: "tel" | "email";
  textContentType: "telephoneNumber" | "emailAddress";
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Text ref={headingRef} accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <Text style={styles.body}>{hint}</Text>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={!busy}
        keyboardType={keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        onChangeText={onChange}
        style={styles.input}
      />
      {error === null ? null : (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
      <PrimaryButton label={submitLabel} disabled={busy} onPress={onSubmit} />
      <SecondaryButton label="Back" disabled={busy} onPress={onBack} />
    </View>
  );
}

function CodeEntry({
  headingRef,
  title,
  sentTo,
  changeLabel,
  code,
  busy,
  error,
  resendIn,
  autoComplete,
  onChange,
  onBack,
  onResend,
  onSubmit,
}: {
  headingRef: React.RefObject<Text | null>;
  title: string;
  sentTo: string;
  changeLabel: string;
  code: string;
  busy: boolean;
  error: string | null;
  resendIn: number;
  autoComplete: "sms-otp" | "one-time-code";
  onChange: (value: string) => void;
  onBack: () => void;
  onResend: () => void;
  onSubmit: () => void;
}) {
  const resendLabel =
    resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code";
  return (
    <View style={styles.stack}>
      <Text ref={headingRef} accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <Text style={styles.body}>Sent to {sentTo}</Text>
      <TextInput
        accessibilityLabel="6-digit code"
        value={code}
        editable={!busy}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        autoComplete={autoComplete}
        textContentType="oneTimeCode"
        onChangeText={(value) => {
          onChange(value.replace(/\D/g, "").slice(0, 6));
        }}
        style={styles.codeInput}
      />
      {error === null ? null : (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
      <PrimaryButton label="Continue" disabled={busy} onPress={onSubmit} />
      <SecondaryButton
        label={resendLabel}
        disabled={busy || resendIn > 0}
        onPress={onResend}
      />
      <SecondaryButton label={changeLabel} disabled={busy} onPress={onBack} />
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, disabled ? styles.disabled : null]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.secondary, disabled ? styles.disabled : null]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    backgroundColor: theme.color.background.canvas,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[8],
    gap: theme.space[4],
  },
  stack: { gap: theme.space[4] },
  brand: {
    color: theme.color.brand.primary,
    fontSize: theme.typeScale.labelLg.fontSize,
    lineHeight: theme.typeScale.labelLg.lineHeight,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heading: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.headingLg.fontSize,
    lineHeight: theme.typeScale.headingLg.lineHeight,
    fontWeight: "700",
  },
  body: {
    color: theme.color.text.secondary,
    fontSize: theme.typeScale.bodyLg.fontSize,
    lineHeight: theme.typeScale.bodyLg.lineHeight,
  },
  label: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.labelMd.fontSize,
    lineHeight: theme.typeScale.labelMd.lineHeight,
    fontWeight: "600",
  },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: theme.color.border.strong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background.surface,
    color: theme.color.text.primary,
    paddingHorizontal: theme.space[4],
    fontSize: theme.typeScale.bodyLg.fontSize,
  },
  codeInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.color.border.strong,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.background.surface,
    color: theme.color.text.primary,
    paddingHorizontal: theme.space[4],
    fontSize: theme.typeScale.headingMd.fontSize,
    letterSpacing: 8,
  },
  error: {
    color: theme.color.state.error,
    backgroundColor: theme.color.state.errorSoft,
    borderRadius: theme.radius.sm,
    padding: theme.space[3],
    fontSize: theme.typeScale.bodySm.fontSize,
    lineHeight: theme.typeScale.bodySm.lineHeight,
  },
  primary: {
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.brand.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space[4],
  },
  primaryLabel: {
    color: theme.color.text.primary,
    fontSize: theme.typeScale.labelLg.fontSize,
    lineHeight: theme.typeScale.labelLg.lineHeight,
    fontWeight: "700",
  },
  secondary: {
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.background.surface,
    borderWidth: 1,
    borderColor: theme.color.border.strong,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space[4],
  },
  secondaryLabel: {
    color: theme.color.brand.primary,
    fontSize: theme.typeScale.labelLg.fontSize,
    lineHeight: theme.typeScale.labelLg.lineHeight,
    fontWeight: "700",
  },
  disabled: { opacity: 0.6 },
});
