"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  readFragmentToken,
  scrubbedAcceptanceUrl,
} from "../lib/invitation-acceptance-url";

type AcceptAction = (formData: FormData) => void | Promise<void>;

function scrubVisibleUrl(): void {
  const next = scrubbedAcceptanceUrl(new URL(window.location.href));
  const visible = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (visible === next) {
    return;
  }
  window.history.replaceState(window.history.state, "", next);
}

export function AcceptInvitationHandoff({
  action,
  notFoundMessage,
}: {
  action: AcceptAction;
  notFoundMessage: string;
}) {
  const capturedToken = useRef<string | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (capturedToken.current === undefined) {
      capturedToken.current = readFragmentToken(window.location.hash);
    }
    scrubVisibleUrl();
    setToken(capturedToken.current);
    setReady(true);

    const onHashChange = () => {
      const nextToken = readFragmentToken(window.location.hash);
      capturedToken.current = nextToken;
      setToken(nextToken);
      scrubVisibleUrl();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
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
