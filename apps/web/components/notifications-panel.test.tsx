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
});
