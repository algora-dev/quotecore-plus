import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "./components/CookieBanner";
import { PillShimmerScript } from "./components/PillShimmerScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuoteCore+",
  description: "Roofing measurement and quoting platform",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Global cookie notice. Self-hides once dismissed (localStorage). */}
        <CookieBanner />
        {/* Drives the .pill-shimmer hover animation: one full sweep per
            pointerenter, plays to completion even if hover ends mid-sweep. */}
        <PillShimmerScript />
      </body>
    </html>
  );
}
