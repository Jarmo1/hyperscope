import Link from "next/link";
import type { Metadata } from "next";

import { getCoinHeatmap, getHeatmap } from "@/lib/heatmap";
import { LiquidationProfile } from "@/components/LiquidationProfile";
import { ShareBar } from "@/components/ShareBar";
import { price as fmtPrice, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ coin: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { coin } = await params;
  const symbol = coin.toUpperCase();
  const title = `${symbol} liquidation map — Hyperscope`;
  return {
    title,
    description: `Where ${symbol} positions on Hyperliquid get force-closed, stacked by price level.`,
    openGraph: { title, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function CoinHeatPage({ params }: Props) {
  const { coin } = await params;
  const heatmap = await getHeatmap();
  const data = getCoinHeatmap(heatmap, coin);

  if (!data) {
    // A coin with too few observed positions is not an error — say so plainly.
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-700 uppercase tracking-tight">
          Not enough {coin.toUpperCase()} data yet
        </h1>
        <p className="text-graphite mt-3">
          Hyperscope hasn&apos;t observed enough open {coin.toUpperCase()} positions with
          liquidation prices near spot to draw a map.
        </p>
        <Link
          href="/heat"
          className="eyebrow inline-block mt-5 border-b border-amber text-amber pb-0.5"
        >
          See the markets that do have data →
        </Link>
      </div>
    );
  }

  const headline = data.peak
    ? `${usd(data.peak.notional)} of ${data.coin} ${data.peak.side === "long" ? "longs" : "shorts"} liquidate around ${fmtPrice(data.peak.price)} on Hyperliquid.`
    : `${usd(data.totalNotional)} of ${data.coin} positions sit within 35% of spot on Hyperliquid.`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="eyebrow mb-1">Liquidation map</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-700 uppercase tracking-tight">
            {data.coin}
          </h1>
        </div>
        <ShareBar path={`/heat/${data.coin.toLowerCase()}`} headline={headline} />
      </div>

      <LiquidationProfile coin={data} />

      <p className="text-[11px] text-graphite mt-5 max-w-2xl leading-relaxed">
        Observed across {heatmap.walletsScanned.toLocaleString()} of the largest accounts
        on Hyperliquid. Positions held outside that pool are not represented, so treat
        these as the floor of what sits at each level, not the total.
      </p>

      <Link
        href="/heat"
        className="eyebrow inline-block mt-4 border-b border-amber text-amber pb-0.5 hover:text-ink hover:border-ink transition-colors"
      >
        All markets →
      </Link>
    </div>
  );
}
