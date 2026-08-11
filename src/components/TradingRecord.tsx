import type { TradeStats } from "@/lib/hyperliquid";
import { pct, pnlClass, timeAgo, usd } from "@/lib/format";

/**
 * What the fill history actually says about a trader. Hyperliquid's own
 * leaderboard shows PnL and nothing else, so win rate, profit factor and the
 * per-coin split are the reason to look someone up here rather than there.
 */
export function TradingRecord({ stats }: { stats: TradeStats }) {
  if (stats.fillCount === 0) {
    return (
      <div className="sheet px-5 py-10 text-center">
        <p className="font-[family-name:var(--font-display)] uppercase tracking-wide text-lg">
          No trades on record
        </p>
        <p className="text-sm text-graphite mt-1">
          Hyperliquid returns no recent fills for this wallet.
        </p>
      </div>
    );
  }

  const capped = stats.fillCount >= 2000;

  return (
    <div className="sheet">
      <div className="flex items-baseline justify-between gap-4 px-4 sm:px-5 py-3 border-b border-rule">
        <h2 className="eyebrow">Trading record</h2>
        <p className="text-[11px] text-graphite">
          {capped ? "last 2,000 fills" : `${stats.fillCount.toLocaleString()} fills`} ·
          through {timeAgo(stats.lastFillTime)}
        </p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 border-b border-rule">
        <Cell label="Realised PnL" tone={pnlClass(stats.realizedPnl)} big>
          {usd(stats.realizedPnl, { sign: true })}
        </Cell>
        <Cell label="Win rate" big>
          {pct(stats.winRate)}
        </Cell>
        <Cell label="Profit factor" big>
          {stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        </Cell>
        <Cell label="Volume traded" big>
          {usd(stats.volume)}
        </Cell>

        <Cell label="Closed trades">{stats.closedTrades.toLocaleString()}</Cell>
        <Cell label="Won / lost">
          {stats.wins.toLocaleString()} / {stats.losses.toLocaleString()}
        </Cell>
        <Cell label="Avg win" tone="text-teal">
          {usd(stats.avgWin, { sign: true })}
        </Cell>
        <Cell label="Avg loss" tone="text-oxblood">
          {usd(stats.avgLoss, { sign: true })}
        </Cell>

        <Cell label="Biggest win" tone="text-teal">
          {usd(stats.biggestWin, { sign: true })}
        </Cell>
        <Cell label="Biggest loss" tone="text-oxblood">
          {usd(stats.biggestLoss, { sign: true })}
        </Cell>
        <Cell label="Fees paid">{usd(stats.feesPaid)}</Cell>
        <Cell label="First fill seen">{timeAgo(stats.firstFillTime)}</Cell>
      </dl>

      <div className="px-4 sm:px-5 py-3">
        <h3 className="eyebrow mb-2">Realised PnL by market</h3>
        <ul className="space-y-1">
          {stats.byCoin.slice(0, 8).map((c) => (
            <CoinBar key={c.coin} {...c} max={maxAbs(stats)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function maxAbs(stats: TradeStats): number {
  return Math.max(1, ...stats.byCoin.map((c) => Math.abs(c.pnl)));
}

function CoinBar({
  coin,
  pnl,
  trades,
  max,
}: {
  coin: string;
  pnl: number;
  trades: number;
  max: number;
}) {
  const width = (Math.abs(pnl) / max) * 50; // half-width each side of centre
  const positive = pnl >= 0;

  return (
    <li className="flex items-center gap-3 text-[12px]">
      <span className="w-20 shrink-0 truncate font-[family-name:var(--font-display)] uppercase tracking-wide">
        {coin}
      </span>

      {/* Diverging bar: losses grow left of centre, wins right. */}
      <span className="relative flex-1 h-3.5">
        <span className="absolute inset-y-0 left-1/2 w-px bg-rule" />
        <span
          className={`absolute inset-y-0 ${positive ? "bg-teal" : "bg-oxblood"}`}
          style={
            positive
              ? { left: "50%", width: `${width}%` }
              : { right: "50%", width: `${width}%` }
          }
        />
      </span>

      <span className={`tnum w-24 text-right ${pnlClass(pnl)}`}>
        {usd(pnl, { sign: true })}
      </span>
      <span className="tnum w-16 text-right text-mist hidden sm:block">
        {trades} {trades === 1 ? "trade" : "trades"}
      </span>
    </li>
  );
}

function Cell({
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
    <div className="px-4 sm:px-5 py-3 border-r border-b border-rule last:border-r-0 [&:nth-child(4n)]:sm:border-r-0 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r">
      <dt className="eyebrow !text-[9px] !tracking-[0.12em] !font-400 text-mist">
        {label}
      </dt>
      <dd className={`tnum ${big ? "text-xl" : "text-sm"} ${tone} mt-0.5`}>{children}</dd>
    </div>
  );
}
