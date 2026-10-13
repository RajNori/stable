import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { WorkspaceNavigation } from "./workspace-navigation";

afterEach(cleanup);

describe("workspace navigation", () => {
  it("keeps keyboard focus in the open drawer and returns it on Escape", () => {
    render(
      <WorkspaceNavigation
        items={[{ href: "/", label: "Overview", icon: "home" }]}
        workspaceName="Club administration"
        accessory={<button type="button">Sign out</button>}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    const firstLink = screen.getByRole("link", { name: "Overview" });
    const brandLink = screen.getByRole("link", { name: "The Stable home" });
    const lastControl = screen.getByRole("button", { name: "Sign out" });

    expect(document.activeElement).toBe(firstLink);
    brandLink.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastControl);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(brandLink);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});
