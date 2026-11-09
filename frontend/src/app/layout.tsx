import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGate from "@/components/AuthGate";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Temple Parties",
  description: "Discover weekend parties at Temple University",
  keywords: ["Temple University", "parties", "events", "Philadelphia", "college"],
  authors: [{ name: "Temple Parties" }],
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Temple Parties",
    description: "Discover weekend parties at Temple University",
    type: "website",
    siteName: "Temple Parties",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Temple Parties",
    description: "Discover weekend parties at Temple University",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) report real values on iPhone (home bar,
  // notch in landscape). Without it every inset is 0 and the Dock, sticky
  // action bar, host prompt and party sheet fall back to their minimums.
  viewportFit: "cover",
  themeColor: "#1a1a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PostHogProvider>
          <AuthProvider>
            <AuthGate>{children}</AuthGate>
          </AuthProvider>
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
