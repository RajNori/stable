import { invitationMessages } from "@stable/invitations";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StrictMode, useState } from "react";

import { AcceptInvitationHandoff } from "./accept-invitation-handoff";

const token = "cd".repeat(32);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/invitations/accept");
  vi.restoreAllMocks();
});

function placeFragment(fragment: string): void {
  window.history.replaceState(null, "", `/invitations/accept${fragment}`);
}

describe("accept invitation handoff", () => {
  it("reads the fragment, scrubs the visible url, and posts the token", () => {
    placeFragment(`#${token}`);
    const replaceState = vi.spyOn(window.history, "replaceState");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const action = vi.fn();

    render(
      <AcceptInvitationHandoff
        action={action}
        notFoundMessage={invitationMessages.notFound}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();
    expect(window.location.href.includes(token)).toBe(false);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/invitations/accept");
    const scrub = replaceState.mock.calls[0];
    if (scrub === undefined) {
      throw new Error("Expected the acceptance URL to be scrubbed.");
    }
    expect(JSON.stringify(scrub[0]).includes(token)).toBe(false);
    expect(String(scrub[2]).includes(token)).toBe(false);
    expect(String(scrub[2]).includes("?token=")).toBe(false);

    const form = screen
      .getByRole("button", { name: "Accept invitation" })
      .closest("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Expected the acceptance form.");
    }
    fireEvent.submit(form);
    const formData = action.mock.calls[0]?.[0];
    if (!(formData instanceof FormData)) {
      throw new Error("Expected the acceptance POST to receive FormData.");
    }
    expect(formData.get("token")).toBe(token);
    expect(
      setItem.mock.calls.some((call) => call.join(" ").includes(token)),
    ).toBe(false);
    expect(document.cookie.includes(token)).toBe(false);
    for (const spy of [log, info, warn, error]) {
      expect(
        spy.mock.calls.some((call) => JSON.stringify(call).includes(token)),
      ).toBe(false);
    }
  });

  it("keeps a valid fragment through Strict Mode effect replay", () => {
    placeFragment(`#${token}`);
    render(
      <StrictMode>
        <AcceptInvitationHandoff
          action={vi.fn()}
          notFoundMessage={invitationMessages.notFound}
        />
      </StrictMode>,
    );

    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(window.location.href.includes(token)).toBe(false);
  });

  it("does not recover the token after the handoff unmounts", () => {
    placeFragment(`#${token}`);
    const first = render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("");
    first.unmount();

    render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).toBeNull();
    expect(window.location.href.includes(token)).toBe(false);
  });

  it("does not recover the token when navigation returns without a fragment", () => {
    function Visit({ showHandoff }: { showHandoff: boolean }) {
      const [visible, setVisible] = useState(showHandoff);
      return (
        <div>
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
          >
            Toggle visit
          </button>
          {visible ? (
            <AcceptInvitationHandoff
              action={vi.fn()}
              notFoundMessage={invitationMessages.notFound}
            />
          ) : (
            <p>Away</p>
          )}
        </div>
      );
    }

    placeFragment(`#${token}`);
    render(<Visit showHandoff />);
    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toggle visit" }));
    expect(screen.getByText("Away")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toggle visit" }));
    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).toBeNull();
    expect(window.location.href.includes(token)).toBe(false);
  });

  it("does not accept a token left in the query string", () => {
    window.history.replaceState(null, "", `/invitations/accept?token=${token}`);
    render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );
    expect(window.location.href.includes(token)).toBe(false);
    expect(window.location.search.includes("token")).toBe(false);
  });

  it("reads a fragment added after the page is already open", () => {
    window.history.replaceState(null, "", "/invitations/accept");
    render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );

    window.history.replaceState(null, "", `/invitations/accept#${token}`);
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(window.location.href.includes(token)).toBe(false);
  });

  it("fails closed when a reload has no fragment", () => {
    render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).toBeNull();
  });

  it("fails closed for a malformed fragment and removes it from the url", () => {
    placeFragment("#not-a-token");
    render(
      <AcceptInvitationHandoff
        action={vi.fn()}
        notFoundMessage={invitationMessages.notFound}
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      invitationMessages.notFound,
    );
    expect(window.location.href.includes("not-a-token")).toBe(false);
    expect(window.location.hash).toBe("");
  });
});
