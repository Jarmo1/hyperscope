import type { Position } from "@/lib/hyperliquid";
import { compactNum, pct, pnlClass, usd } from "@/lib/format";
import { LiqLadder, severityOf } from "./LiqLadder";

export function PositionsSheet({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="sheet px-5 py-10 text-center">
        <p className="font-[family-name:var(--font-display)] uppercase tracking-wide text-lg">
          Flat
        </p>
        <p className="text-sm text-graphite mt-1">
          This wallet has no open positions right now.
        </p>
      </div>
    );
  }

  const totalNotional = positions.reduce((sum, p) => sum + p.notional, 0);
  const totalUpnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <div className="sheet">
      <div className="flex items-baseline justify-between gap-4 px-4 sm:px-5 py-3 border-b border-rule">
        <h2 className="eyebrow">Open positions · {positions.length}</h2>
        <div className="flex items-baseline gap-4 text-[11px]">
          <span className="text-graphite">
            exposure <span className="tnum text-ink">{usd(totalNotional)}</span>
          </span>
          <span className="text-graphite">
            unrealised{" "}
            <span className={`tnum ${pnlClass(totalUpnl)}`}>
              {usd(totalUpnl, { sign: true })}
            </span>
          </span>
        </div>
      </div>

      <ul>
        {positions.map((p) => (
          <PositionRow key={p.coin} position={p} />
        ))}
      </ul>
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const severity = severityOf(p.liqDistance);

  return (
    <li className="px-4 sm:px-5 py-4 border-b border-rule last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <span className="font-[family-name:var(--font-display)] text-lg font-600 uppercase tracking-tight">
          {p.coin}
        </span>

        <SideBadge side={p.side} />

        <span className="tnum text-[11px] text-graphite">
          {p.leverage}× {p.leverageType}
        </span>

        <span className="flex-1" />

        <dl className="flex items-baseline gap-x-5 gap-y-1 flex-wrap">
          <Metric label="size">
            {compactNum(p.size)} <span className="text-mist">{p.coin}</span>
          </Metric>
          <Metric label="notional">{usd(p.notional)}</Metric>
          <Metric label="unrealised" tone={pnlClass(p.unrealizedPnl)}>
            {usd(p.unrealizedPnl, { sign: true })}
          </Metric>
          <Metric label="roe" tone={pnlClass(p.roe)}>
            {pct(p.roe, { sign: true })}
          </Metric>
          <Metric
            label="to liq"
            tone={
              severity === "critical"
                ? "text-oxblood"
                : severity === "warning"
                  ? "text-amber"
                  : "text-ink"
            }
          >
            {p.liqDistance != null ? pct(p.liqDistance) : "—"}
          </Metric>
        </dl>
      </div>

      <LiqLadder position={p} />
    </li>
  );
}

function Metric({
  label,
  tone = "text-ink",
  children,
}: {
  label: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-right">
      <dt className="eyebrow !text-[9px] !tracking-[0.12em] !font-400 text-mist">
        {label}
      </dt>
      <dd className={`tnum text-[13px] ${tone}`}>{children}</dd>
    </div>
  );
}

function SideBadge({ side }: { side: "long" | "short" }) {
  const isLong = side === "long";
  return (
    <span
      className={`eyebrow !text-[10px] px-1.5 py-0.5 border ${
        isLong
          ? "text-teal border-teal/40 bg-teal-soft/50"
          : "text-oxblood border-oxblood/40 bg-oxblood-soft/50"
      }`}
    >
      {side}
    </span>
  );
}
