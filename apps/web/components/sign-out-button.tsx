"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signOutLiveWebAuthSession } from "../lib/auth-session";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

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
      className="workspace-sign-out"
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onSignOut().finally(() => {
          setBusy(false);
        });
      }}
    >
      Sign out
    </button>
  );
}
