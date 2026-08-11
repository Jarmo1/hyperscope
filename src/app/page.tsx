import Link from "next/link";
import { Suspense } from "react";

import { AddressSearch } from "@/components/AddressSearch";
import { LiqLadder, severityOf } from "@/components/LiqLadder";
import { getRiskBoard, type RiskEntry } from "@/lib/riskboard";
import { pct, pnlClass, usd } from "@/lib/format";
import { shortAddress } from "@/lib/hyperliquid";

export default async function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <section className="max-w-3xl">
        <p className="eyebrow mb-3">Hyperliquid · live</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-6xl font-700 leading-[0.95] tracking-tight uppercase">
          See how close
          <br />
          they are to zero.
        </h1>
        <p className="text-base sm:text-lg text-graphite mt-4 max-w-xl">
          Every Hyperliquid position has an entry, a mark and a liquidation price. Paste
          a wallet and Hyperscope draws the gap between them — plus the win rate the
          leaderboard never shows you.
        </p>
        <div className="mt-6 max-w-2xl">
          <AddressSearch />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-700 uppercase tracking-tight">
            Closest to liquidation
          </h2>
          <p className="text-[11px] text-graphite max-w-md sm:text-right">
            The busiest accounts on Hyperliquid, ranked by how little room their tightest
            position has left. Refreshes every 90 seconds.
          </p>
        </div>

        {/* Streamed: the scan takes seconds on a cold cache, and the hero
            should never wait on it. */}
        <Suspense fallback={<RiskBoardSkeleton />}>
          <RiskBoard />
        </Suspense>

        <Link
          href="/board"
          className="eyebrow inline-block mt-4 border-b border-amber text-amber pb-0.5 hover:text-ink hover:border-ink transition-colors"
        >
          See the full board →
        </Link>
      </section>

      <section className="mt-16 grid gap-8 sm:grid-cols-3 border-t border-rule pt-8">
        <Explainer title="Read-only, always">
          Hyperscope never asks you to connect a wallet or sign anything. It only reads
          Hyperliquid&apos;s public API — the same data the exchange serves its own
          front end.
        </Explainer>
        <Explainer title="Win rate, not just PnL">
          The official leaderboard ranks on profit, which flatters anyone big enough.
          Hyperscope works out win rate, profit factor and per-market PnL from the raw
          fills.
        </Explainer>
        <Explainer title="Free, no account">
          Every wallet page is public and shareable. Nothing is gated, and there is
          nothing to sign up for.
        </Explainer>
      </section>
    </div>
  );
}

async function RiskBoard() {
  const board = await getRiskBoard();
  const closest = board.slice(0, 6);

  if (closest.length === 0) {
    return (
      <div className="sheet px-5 py-10 text-center text-sm text-graphite">
        Hyperliquid didn&apos;t return position data for this scan. Try again shortly.
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {closest.map((entry) => (
        <RiskCard key={entry.address} entry={entry} />
      ))}
    </ul>
  );
}

function RiskBoardSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="sheet border-l-2 border-l-rule-strong px-4 py-3">
          <div className="h-3 w-32 bg-shade" />
          <div className="h-6 w-24 bg-shade mt-3" />
          <div className="h-[5px] w-full bg-shade mt-6" />
          <div className="h-3 w-40 bg-shade mt-5" />
        </li>
      ))}
    </ul>
  );
}

function RiskCard({ entry }: { entry: RiskEntry }) {
  const { tightest } = entry;
  const severity = severityOf(tightest.liqDistance);
  const accent =
    severity === "critical"
      ? "border-l-oxblood"
      : severity === "warning"
        ? "border-l-amber"
        : "border-l-rule-strong";

  return (
    <li className={`sheet border-l-2 ${accent}`}>
      <Link href={`/w/${entry.address}`} className="block px-4 py-3 hover:bg-shade/40 transition-colors">
        <div className="flex items-baseline justify-between gap-3">
          <span className="tnum text-[13px]">
            {entry.displayName ?? shortAddress(entry.address)}
          </span>
          <span className="tnum text-[11px] text-graphite">
            {usd(entry.accountValue)} account
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="font-[family-name:var(--font-display)] text-xl font-600 uppercase tracking-tight">
            {tightest.coin}
          </span>
          <span
            className={`eyebrow !text-[10px] ${
              tightest.side === "long" ? "text-teal" : "text-oxblood"
            }`}
          >
            {tightest.side} {tightest.leverage}×
          </span>
          <span className="flex-1" />
          <span
            className={`tnum text-lg ${
              severity === "critical"
                ? "text-oxblood"
                : severity === "warning"
                  ? "text-amber"
                  : "text-ink"
            }`}
          >
            {pct(tightest.liqDistance)}
          </span>
          <span className="eyebrow !text-[9px] text-mist">to liq</span>
        </div>

        <LiqLadder position={tightest} />

        <div className="flex justify-between text-[11px] text-graphite pt-1 border-t border-rule mt-1">
          <span>
            {entry.positionCount} position{entry.positionCount === 1 ? "" : "s"} ·{" "}
            {usd(entry.totalNotional)} exposure
          </span>
          <span className={`tnum ${pnlClass(entry.totalUpnl)}`}>
            {usd(entry.totalUpnl, { sign: true })}
          </span>
        </div>
      </Link>
    </li>
  );
}

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-base font-600 uppercase tracking-wide mb-1.5">
        {title}
      </h3>
      <p className="text-[13px] text-graphite leading-relaxed">{children}</p>
    </div>
  );
}
