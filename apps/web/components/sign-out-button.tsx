"use client";

import { themeFor } from "@stable/design-tokens";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { signOutLiveWebAuthSession } from "../lib/auth-session";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

const theme = themeFor("mustangs");

export function SignOutButton({
  supabaseUrl,
  publishableKey,
}: {
  supabaseUrl: string;
  publishableKey: string;
}) {
  const router = useRouter();
  return (
    <SignOutControl
      onSignOut={async () => {
        await signOutLiveWebAuthSession(
          createSupabaseBrowserClient({ url: supabaseUrl, publishableKey }),
        );
        router.refresh();
      }}
    />
  );
}

export function SignOutControl({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onSignOut().finally(() => {
          setBusy(false);
        });
      }}
      style={{
        marginTop: theme.space[8],
        minHeight: 44,
        minWidth: 44,
        padding: `0 ${theme.space[4]}px`,
        background: "transparent",
        color: theme.color.brand.accent,
        border: `1px solid ${theme.color.brand.accent}`,
        borderRadius: theme.radius.sm,
      }}
    >
      Sign out
    </button>
  );
}
