import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { getHeatmap } from "@/lib/heatmap";
import { LiquidationProfile } from "@/components/LiquidationProfile";
import { pct, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Where Hyperliquid liquidations are stacked",
  description:
    "Open positions aggregated by liquidation price, showing which levels unwind the most money.",
};

export default async function HeatPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="eyebrow mb-2">Hyperliquid</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-700 uppercase tracking-tight leading-[0.95]">
        Where the liquidations are
      </h1>
      <p className="text-graphite mt-3 max-w-2xl">
        Every open position publishes the price at which it gets force-closed. Stack
        those together and you can see which levels have the most money waiting to
        unwind — the levels price tends to get pulled toward.
      </p>

      {/* A cold snapshot costs a full scan, so never make the page wait on it. */}
      <Suspense fallback={<HeatSkeleton />}>
        <Maps />
      </Suspense>

      <p className="text-[11px] text-graphite mt-6 max-w-3xl leading-relaxed">
        Built from the largest accounts on Hyperliquid, scanned in rolling batches to
        stay inside the exchange&apos;s rate limits, so coverage grows over the first few
        minutes and positions from accounts outside the pool are not represented. Only
        liquidation prices within 35% of spot are charted. This shows where forced
        selling sits — it is not a prediction that price goes there.
      </p>
    </div>
  );
}

async function Maps() {
  const heatmap = await getHeatmap();
  const charted = heatmap.coins.slice(0, 6);

  return (
    <>
      <dl className="sheet grid grid-cols-2 sm:grid-cols-4 mt-6">
        <Stat label="Accounts in snapshot">{heatmap.walletsScanned.toLocaleString()}</Stat>
        <Stat label="Pool covered">{pct(heatmap.coverage)}</Stat>
        <Stat label="Notional observed">{usd(heatmap.coveredNotional)}</Stat>
        <Stat label="Markets charted">{heatmap.coins.length.toLocaleString()}</Stat>
      </dl>

      {charted.length === 0 ? (
        <div className="sheet mt-5 px-5 py-10 text-center text-sm text-graphite">
          No market has enough observed positions near spot to chart yet. Coverage grows
          as the scan cycles — refresh in a minute.
        </div>
      ) : (
        <div className="grid gap-4 mt-5">
          {charted.map((coin) => (
            <div key={coin.coin}>
              <LiquidationProfile coin={coin} />
              <Link
                href={`/heat/${coin.coin.toLowerCase()}`}
                className="eyebrow inline-block mt-2 border-b border-amber text-amber pb-0.5 hover:text-ink hover:border-ink transition-colors"
              >
                Share {coin.coin} map →
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function HeatSkeleton() {
  return (
    <div aria-busy="true">
      <div className="sheet grid grid-cols-2 sm:grid-cols-4 mt-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="px-4 sm:px-5 py-3 border-r border-b border-rule">
            <div className="h-2 w-20 bg-shade" />
            <div className="h-5 w-16 bg-shade mt-2" />
          </div>
        ))}
      </div>
      <div className="sheet mt-5 px-4 py-4">
        <div className="h-4 w-24 bg-shade" />
        <div className="mt-4 space-y-[3px]">
          {Array.from({ length: 22 }, (_, i) => (
            <div
              key={i}
              className="h-[6px] bg-shade"
              // A ragged profile shape reads as loading data, not a broken bar.
              style={{ width: `${18 + ((i * 37) % 62)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-5 py-3 border-r border-b border-rule [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(4n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 sm:[&:nth-last-child(-n+4)]:border-b-0">
      <dt className="eyebrow !text-[9px] !tracking-[0.12em] !font-400 text-mist">
        {label}
      </dt>
      <dd className="tnum text-xl mt-0.5">{children}</dd>
    </div>
  );
}
