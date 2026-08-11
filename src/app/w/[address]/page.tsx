import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  computeStats,
  getAllMids,
  getClearinghouseState,
  getPortfolio,
  getUserFills,
  isAddress,
  shortAddress,
  toPositions,
  WINDOWS,
  type Window,
} from "@/lib/hyperliquid";
import { getTrader } from "@/lib/leaderboard";
import { pct, pnlClass, usd } from "@/lib/format";
import { EquityCurve } from "@/components/EquityCurve";
import { PositionsSheet } from "@/components/PositionsSheet";
import { ShareBar } from "@/components/ShareBar";
import { TradingRecord } from "@/components/TradingRecord";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ w?: string }>;
};

function parseWindow(value: string | undefined): Window {
  const allowed: Window[] = ["day", "week", "month", "allTime"];
  return allowed.includes(value as Window) ? (value as Window) : "week";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!isAddress(address)) return { title: "Wallet not found — Hyperscope" };

  const title = `${shortAddress(address)} on Hyperliquid — Hyperscope`;
  return {
    title,
    description: `Live positions, distance to liquidation and win rate for ${shortAddress(address)}.`,
    openGraph: { title, type: "website" },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function WalletPage({ params, searchParams }: Props) {
  const { address } = await params;
  const { w } = await searchParams;
  if (!isAddress(address)) notFound();

  const window = parseWindow(w);

  const [state, fills, portfolio, mids, ranked] = await Promise.all([
    getClearinghouseState(address),
    getUserFills(address),
    getPortfolio(address),
    getAllMids(),
    getTrader(address).catch(() => null),
  ]);

  const positions = toPositions(state, mids);
  const stats = computeStats(fills);
  const accountValue = Number(state.marginSummary.accountValue);
  const totalUpnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const marginUsed = Number(state.marginSummary.totalMarginUsed);
  const exposure = Number(state.marginSummary.totalNtlPos);

  const windowEntry = portfolio.find(([key]) => key === window)?.[1];
  const windowPerf = ranked?.perf[window];

  const headline = buildHeadline(address, positions.length, totalUpnl, windowPerf?.pnl);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Wallet</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-700 tracking-tight break-all">
            {ranked?.displayName ?? shortAddress(address)}
          </h1>
          <p className="tnum text-[11px] text-graphite mt-1 break-all">{address}</p>
        </div>
        <ShareBar path={`/w/${address}`} headline={headline} />
      </div>

      {/* Account summary */}
      <dl className="sheet grid grid-cols-2 lg:grid-cols-4 mb-4">
        <Summary label="Account value" big>
          {usd(accountValue)}
        </Summary>
        <Summary label="Open exposure" big>
          {usd(exposure)}
        </Summary>
        <Summary label="Unrealised PnL" tone={pnlClass(totalUpnl)} big>
          {usd(totalUpnl, { sign: true })}
        </Summary>
        <Summary
          label={`PnL · ${WINDOWS.find((x) => x.key === window)?.label}`}
          tone={windowPerf ? pnlClass(windowPerf.pnl) : undefined}
          big
        >
          {windowPerf ? usd(windowPerf.pnl, { sign: true }) : "—"}
        </Summary>

        <Summary label="Margin used">
          {usd(marginUsed)}{" "}
          <span className="text-mist text-[11px]">
            ({pct(accountValue > 0 ? marginUsed / accountValue : null)})
          </span>
        </Summary>
        <Summary label="Withdrawable">{usd(Number(state.withdrawable))}</Summary>
        <Summary label="Account leverage">
          {accountValue > 0 ? `${(exposure / accountValue).toFixed(2)}×` : "—"}
        </Summary>
        <Summary label={`ROI · ${WINDOWS.find((x) => x.key === window)?.label}`}>
          {windowPerf ? pct(windowPerf.roi, { sign: true }) : "—"}
        </Summary>
      </dl>

      <WindowTabs address={address} active={window} />

      <div className="grid gap-4 mt-4">
        {windowEntry && (
          <EquityCurve
            history={windowEntry.accountValueHistory}
            label={WINDOWS.find((x) => x.key === window)?.label ?? window}
          />
        )}
        <PositionsSheet positions={positions} />
        <TradingRecord stats={stats} />
      </div>

      <p className="text-[11px] text-graphite mt-6">
        Data straight from Hyperliquid&apos;s public API, read live on each load. Fill
        history is capped at the most recent 2,000 fills, so lifetime totals for very
        active wallets are understated.{" "}
        <Link href="/board" className="text-amber hover:underline">
          Find more traders on the board
        </Link>
        .
      </p>
    </div>
  );
}

function WindowTabs({ address, active }: { address: string; active: Window }) {
  return (
    <nav className="flex items-center gap-px border border-rule bg-rule">
      {WINDOWS.map((wnd) => (
        <Link
          key={wnd.key}
          href={`/w/${address}?w=${wnd.key}`}
          className={`eyebrow flex-1 text-center py-2 transition-colors ${
            wnd.key === active
              ? "bg-ink text-paper"
              : "bg-paper text-graphite hover:text-ink hover:bg-shade"
          }`}
          aria-current={wnd.key === active ? "page" : undefined}
        >
          {wnd.label}
        </Link>
      ))}
    </nav>
  );
}

function Summary({
  label,
  tone = "text-ink",
  big = false,
  children,
}: {
  label: string;
  tone?: string;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 sm:px-5 py-3 border-r border-b border-rule [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+4)]:border-b-0">
      <dt className="eyebrow !text-[9px] !tracking-[0.12em] !font-400 text-mist">
        {label}
      </dt>
      <dd className={`tnum ${big ? "text-2xl" : "text-sm"} ${tone} mt-0.5`}>{children}</dd>
    </div>
  );
}

/** Copy for the X share intent — states the fact, no hype. */
function buildHeadline(
  address: string,
  positionCount: number,
  upnl: number,
  windowPnl: number | undefined,
): string {
  const who = shortAddress(address);
  if (positionCount === 0) {
    return `${who} is flat on Hyperliquid right now.`;
  }
  const pnlPart =
    windowPnl != null
      ? ` ${usd(windowPnl, { sign: true })} this week,`
      : "";
  return `${who} has ${positionCount} position${positionCount === 1 ? "" : "s"} open on Hyperliquid —${pnlPart} ${usd(upnl, { sign: true })} unrealised.`;
}
