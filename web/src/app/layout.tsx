import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toaster";
import { Splash } from "@/components/splash";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Gymix", template: "%s · Gymix" },
  description: "The operating system for your gym.",
  // Installed on a phone's home screen: full screen, Gymix icon and name.
  appleWebApp: { capable: true, title: "Gymix", statusBarStyle: "default" },
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" }, apple: "/icons/180" },
};

// viewportFit "cover" lets the app use the whole iPhone screen, so the bottom
// bar can pad itself clear of the home indicator (env(safe-area-inset-bottom)).
// maximumScale 1: phones don't zoom in when a field is tapped.
export const viewport: Viewport = { themeColor: "#0d1117", viewportFit: "cover", maximumScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the splash script sets data-splash before React loads.
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        <Splash />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
