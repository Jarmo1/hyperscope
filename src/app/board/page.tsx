import Link from "next/link";
import type { Metadata } from "next";

import { queryLeaderboard, turnoverOf, type LeaderboardQuery } from "@/lib/leaderboard";
import { WINDOWS, shortAddress, type Window } from "@/lib/hyperliquid";
import { pct, pnlClass, usd } from "@/lib/format";

export const metadata: Metadata = {
  title: "The board — Hyperliquid traders worth watching",
  description:
    "Filter Hyperliquid traders by account size, ROI and volume — not just raw profit.",
};

export const dynamic = "force-dynamic";

type Sort = "pnl" | "roi" | "vlm" | "accountValue";

/**
 * Account-size brackets. Sorting a mixed leaderboard by ROI is meaningless —
 * a $12k account doubling beats every professional on the exchange — so size
 * is a first-class filter rather than a footnote.
 */
const SIZE_BANDS = [
  { key: "all", label: "Any size", min: 0, max: Infinity },
  { key: "small", label: "$10k–100k", min: 10_000, max: 100_000 },
  { key: "mid", label: "$100k–1M", min: 100_000, max: 1_000_000 },
  { key: "large", label: "$1M–10M", min: 1_000_000, max: 10_000_000 },
  { key: "whale", label: "$10M+", min: 10_000_000, max: Infinity },
] as const;

const SORTS: { key: Sort; label: string }[] = [
  { key: "pnl", label: "Profit" },
  { key: "roi", label: "Return %" },
  { key: "vlm", label: "Volume" },
  { key: "accountValue", label: "Account size" },
];

type Props = {
  searchParams: Promise<{ w?: string; sort?: string; size?: string }>;
};

export default async function BoardPage({ searchParams }: Props) {
  const sp = await searchParams;

  const window: Window = (["day", "week", "month", "allTime"] as Window[]).includes(
    sp.w as Window,
  )
    ? (sp.w as Window)
    : "week";
  // Dollars made is the unambiguous default. Return is time-weighted, so a huge
  // percentage can come from a tiny starting balance rather than skill.
  const sort: Sort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as Sort) : "pnl";
  const band = SIZE_BANDS.find((b) => b.key === sp.size) ?? SIZE_BANDS[2];

  const query: LeaderboardQuery = {
    window,
    sort,
    minAccountValue: band.min,
    maxAccountValue: band.max,
    // Requiring volume in the window filters out dormant accounts whose ROI is
    // an artefact of a deposit rather than a trade.
    minVolume: 1,
    minTurnover: 1,
    limit: 100,
  };

  const traders = await queryLeaderboard(query);
  const windowLabel = WINDOWS.find((x) => x.key === window)?.label ?? window;

  const href = (next: Partial<{ w: string; sort: string; size: string }>) => {
    const params = new URLSearchParams({
      w: window,
      sort,
      size: band.key,
      ...next,
    });
    return `/board?${params}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <p className="eyebrow mb-2">Hyperliquid</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-700 uppercase tracking-tight leading-[0.95]">
        The board
      </h1>
      <p className="text-graphite mt-3 max-w-2xl">
        Hyperliquid ranks traders by raw profit, so the same handful of enormous accounts
        sit on top forever. Bracket by account size and the people actually compounding
        show up.
      </p>

      <div className="mt-6 space-y-px">
        <FilterRow label="Window">
          {WINDOWS.map((wnd) => (
            <Chip key={wnd.key} href={href({ w: wnd.key })} active={wnd.key === window}>
              {wnd.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Account size">
          {SIZE_BANDS.map((b) => (
            <Chip key={b.key} href={href({ size: b.key })} active={b.key === band.key}>
              {b.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Rank by">
          {SORTS.map((s) => (
            <Chip key={s.key} href={href({ sort: s.key })} active={s.key === sort}>
              {s.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <div className="sheet mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-rule-strong">
              <Th className="w-10 text-right">#</Th>
              <Th>Trader</Th>
              <Th className="text-right">Account</Th>
              <Th className="text-right">PnL · {windowLabel}</Th>
              <Th className="text-right">Return</Th>
              <Th className="text-right">Volume</Th>
              <Th className="text-right">Turnover</Th>
            </tr>
          </thead>
          <tbody>
            {traders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-graphite">
                  No traders match that bracket in the {windowLabel.toLowerCase()} window.
                </td>
              </tr>
            )}
            {traders.map((t, i) => {
              const perf = t.perf[window];
              return (
                <tr
                  key={t.address}
                  className="border-b border-rule last:border-b-0 hover:bg-shade/40 transition-colors"
                >
                  <td className="tnum px-2 py-2.5 text-right text-mist text-[11px]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/w/${t.address}?w=${window}`}
                      className="tnum text-[13px] hover:text-amber transition-colors"
                    >
                      {t.displayName ?? shortAddress(t.address)}
                    </Link>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right">{usd(t.accountValue)}</td>
                  <td className={`tnum px-3 py-2.5 text-right ${pnlClass(perf?.pnl ?? 0)}`}>
                    {perf ? usd(perf.pnl, { sign: true }) : "—"}
                  </td>
                  <td className={`tnum px-3 py-2.5 text-right ${pnlClass(perf?.roi ?? 0)}`}>
                    {perf ? pct(perf.roi, { sign: true }) : "—"}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-graphite">
                    {perf ? usd(perf.vlm) : "—"}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-graphite">
                    {(() => {
                      const turnover = turnoverOf(t, window);
                      return turnover != null ? `${turnover.toFixed(1)}×` : "—";
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite mt-4 max-w-3xl leading-relaxed">
        Showing up to 100 traders. <strong className="font-600 text-ink">PnL</strong> is
        dollars made in the window. <strong className="font-600 text-ink">Return</strong>{" "}
        is Hyperliquid&apos;s time-weighted ROI, so a very large percentage often means a
        small starting balance rather than a large win — the two columns disagree for
        about one account in ten, and both are right.{" "}
        <strong className="font-600 text-ink">Turnover</strong> is window volume against
        account size; accounts that traded less than their own size are hidden. Click any
        trader to read their open positions.
      </p>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow !text-[10px] w-24 shrink-0 text-mist">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`eyebrow !text-[10px] px-2.5 py-1 border transition-colors ${
        active
          ? "bg-ink text-paper border-ink"
          : "bg-paper text-graphite border-rule hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Th({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={`eyebrow !text-[9px] !tracking-[0.12em] !font-400 text-mist px-3 py-2 text-left ${className}`}
    >
      {children}
    </th>
  );
}
