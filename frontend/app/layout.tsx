import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-SDLC | Multi-Agent Development Assistant",
  description: "An intelligent multi-agent system that guides you through framework selection, page composition, color theming, and code generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: browser extensions (e.g. UI.Vision/Kantu) add attributes
  // to <html> before React loads; it only covers this element's own attributes.
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div id="app-root" style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
