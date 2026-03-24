import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Manrope,
  Space_Grotesk,
  Bricolage_Grotesque,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: (() => {
    const rawUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      process.env.VERCEL_URL ??
      "http://localhost:3000";
    const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    return new URL(normalizedUrl);
  })(),
  title: "carbon's life operating system",
  description: "align vision, goals, projects, and daily focus in one system.",
  openGraph: {
    title: "carbon's life operating system",
    description: "align vision, goals, projects, and daily focus in one system.",
    siteName: "life operating system",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "life OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "carbon's life operating system",
    description: "align vision, goals, projects, and daily focus in one system.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${spaceGrotesk.variable} ${bricolageGrotesque.variable} ${instrumentSerif.variable} min-h-screen text-foreground bg-background font-sans antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
