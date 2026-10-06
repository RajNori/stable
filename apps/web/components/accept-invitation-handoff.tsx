"use client";

import { useLayoutEffect, useState } from "react";

import {
  readFragmentToken,
  scrubbedAcceptanceUrl,
} from "../lib/invitation-acceptance-url";

type AcceptAction = (formData: FormData) => void | Promise<void>;

let retainedFragmentToken: string | null | undefined;

export function resetInvitationHandoffMemory(): void {
  retainedFragmentToken = undefined;
}

function scrubVisibleUrl(): void {
  const next = scrubbedAcceptanceUrl(new URL(window.location.href));
  const visible = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (visible === next) {
    return;
  }
  window.history.replaceState(window.history.state, "", next);
}

function takeFragmentToken(): string | null {
  const hash = window.location.hash;
  const fromFragment = readFragmentToken(hash);
  if (fromFragment !== null) {
    retainedFragmentToken = fromFragment;
    scrubVisibleUrl();
    return fromFragment;
  }
  if (hash !== "") {
    retainedFragmentToken = null;
  }
  scrubVisibleUrl();
  if (
    hash === "" &&
    retainedFragmentToken !== undefined &&
    retainedFragmentToken !== null
  ) {
    return retainedFragmentToken;
  }
  return null;
}

export function AcceptInvitationHandoff({
  action,
  notFoundMessage,
}: {
  action: AcceptAction;
  notFoundMessage: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const syncFromFragment = () => {
      setToken(takeFragmentToken());
      setReady(true);
    };
    syncFromFragment();
    window.addEventListener("hashchange", syncFromFragment);
    return () => {
      window.removeEventListener("hashchange", syncFromFragment);
    };
  }, []);

  if (!ready) {
    return null;
  }
  if (token === null) {
    return <p role="alert">{notFoundMessage}</p>;
  }
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <button type="submit">Accept invitation</button>
    </form>
  );
}
