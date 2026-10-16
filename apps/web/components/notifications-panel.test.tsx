import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NotificationsPanel } from "./notifications-panel";

describe("notifications panel", () => {
  it("shows device registration and a category preference", () => {
    const html = renderToStaticMarkup(
      <NotificationsPanel
        categories={[
          { category: "ANNOUNCEMENT_PUBLISHED", pushEnabled: false },
        ]}
        registerDevice={() => Promise.resolve()}
        savePreferences={() => Promise.resolve()}
      />,
    );
    expect(html).toContain("Register device");
    expect(html).toContain("ANNOUNCEMENT_PUBLISHED");
    expect(html).not.toContain("checked");
  });

  it("shows enabled preferences, supported platforms, and an action error", () => {
    const html = renderToStaticMarkup(
      <NotificationsPanel
        categories={[
          { category: "ANNOUNCEMENT_PUBLISHED", pushEnabled: true },
          { category: "GAME_REMINDER", pushEnabled: false },
        ]}
        error="Device registration failed."
        registerDevice={() => Promise.resolve()}
        savePreferences={() => Promise.resolve()}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Device registration failed.");
    expect(html).toContain('value="WEB"');
    expect(html).toContain('value="IOS"');
    expect(html).toContain('value="ANDROID"');
    expect(html).toContain('name="ANNOUNCEMENT_PUBLISHED" checked=""');
    expect(html).toContain('type="checkbox" name="GAME_REMINDER"');
  });
});
