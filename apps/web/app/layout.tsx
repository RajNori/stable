import type { ReactNode } from "react";
import { themeFor } from "@stable/design-tokens";

export const metadata = {
  title: "The Stable",
  description: "Club administration",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = themeFor("mustangs");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: theme.color.background.canvas,
          color: theme.color.text.primary,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
