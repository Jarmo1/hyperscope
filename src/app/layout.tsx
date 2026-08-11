import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * og:image must be an absolute URL for X, Telegram and Farcaster to fetch it,
 * so metadataBase has to resolve in every environment the app runs in.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Hyperscope — read any Hyperliquid wallet",
  description:
    "Live positions, distance to liquidation, and real win rate for any Hyperliquid trader. Free, no wallet connection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`}
      >
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-rule">
            <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-6">
              <Link href="/" className="flex items-baseline gap-2.5 group">
                <span className="font-[family-name:var(--font-display)] text-xl font-700 tracking-tight uppercase">
                  Hyperscope
                </span>
                <span className="hidden sm:inline text-[11px] text-graphite tracking-wide">
                  Hyperliquid risk desk
                </span>
              </Link>
              <nav className="flex items-center gap-5 eyebrow">
                <Link href="/board" className="hover:text-amber transition-colors">
                  The board
                </Link>
                <a
                  href="https://app.hyperliquid.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber transition-colors"
                >
                  Trade ↗
                </a>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-rule mt-16">
            <div className="mx-auto max-w-6xl px-5 py-6 flex flex-wrap gap-x-6 gap-y-2 justify-between text-[11px] text-graphite">
              <p>
                Public Hyperliquid data. Read-only — Hyperscope never asks to connect a
                wallet.
              </p>
              <p>Not financial advice. Positions shown are other people&apos;s.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
