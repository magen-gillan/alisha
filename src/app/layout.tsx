import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// basePath is required for GitHub Pages project sites
const BASE = "/alisha";

export const metadata: Metadata = {
  title: "Alisha — Live2D Avatar with Gemini AI",
  description:
    "An interactive Live2D avatar powered by Gemini AI. Speak or type in any language; Alisha responds by voice in your chosen language.",
  keywords: ["Alisha", "Live2D", "Gemini", "AI Avatar", "Voice Chat", "Next.js"],
  authors: [{ name: "Alisha Project" }],
  icons: {
    icon: `${BASE}/logo.svg`,
  },
  openGraph: {
    title: "Alisha — Live2D Avatar with Gemini AI",
    description:
      "Interactive Live2D avatar with voice and text chat powered by Gemini.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alisha — Live2D Avatar",
    description: "Interactive Live2D avatar with Gemini AI.",
  },
};

// Mobile viewport: use the smaller of the two values when keyboard is open.
// `interactive-widget=resizes-content` makes the layout viewport shrink when
// the on-screen keyboard appears, so our fixed-position UI (avatar, buttons,
// text input) all stay visible above the keyboard.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
