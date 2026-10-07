import { DEVICE_PLATFORMS } from "@stable/notifications";

export function NotificationsPanel({
  categories,
  error,
  registerDevice,
  savePreferences,
}: {
  categories: readonly { category: string; pushEnabled: boolean }[];
  error?: string;
  registerDevice: (formData: FormData) => Promise<void>;
  savePreferences: (formData: FormData) => Promise<void>;
}) {
  return (
    <section aria-label="Notifications">
      <h2 style={{ margin: 0 }}>Notifications</h2>
      {error === undefined ? null : <p role="alert">{error}</p>}
      <form action={registerDevice}>
        <label htmlFor="device-token">
          Device token
          <input id="device-token" name="token" required />
        </label>
        <label htmlFor="device-platform">
          Platform
          <select id="device-platform" name="platform" defaultValue="WEB">
            {DEVICE_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Register device</button>
      </form>
      <form action={savePreferences}>
        {categories.map((category) => (
          <label
            key={category.category}
            htmlFor={`preference-${category.category}`}
          >
            <input
              id={`preference-${category.category}`}
              name={category.category}
              type="checkbox"
              defaultChecked={category.pushEnabled}
            />
            {category.category}
          </label>
        ))}
        <button type="submit">Save preferences</button>
      </form>
    </section>
  );
}
