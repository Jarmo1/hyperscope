import type { CoinHeatmap } from "@/lib/heatmap";
import { price as fmtPrice, usd } from "@/lib/format";

/**
 * Liquidations stacked by price level, drawn as a volume profile: price runs
 * up the vertical axis and each row's bar is the notional that gets force-closed
 * there. Longs sit below spot, shorts above, so the shape shows which direction
 * has more fuel behind a move.
 */
export function LiquidationProfile({ coin }: { coin: CoinHeatmap }) {
  // Highest price at the top, matching every chart this audience already reads.
  const rows = [...coin.buckets].reverse();
  const max = Math.max(...rows.map((b) => b.longNotional + b.shortNotional), 1);

  // Where spot sits, so the mark line lands between the right two rows.
  const markIndex = rows.findIndex((b) => b.price <= coin.markPx);

  return (
    <div className="sheet">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 sm:px-5 py-3 border-b border-rule">
        <div className="flex items-baseline gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-700 uppercase tracking-tight">
            {coin.coin}
          </h2>
          <span className="tnum text-[13px] text-graphite">
            mark {fmtPrice(coin.markPx)}
          </span>
        </div>
        <div className="flex items-baseline gap-4 text-[11px] text-graphite">
          <span>
            longs <span className="tnum text-teal">{usd(coin.longNotional)}</span>
          </span>
          <span>
            shorts <span className="tnum text-oxblood">{usd(coin.shortNotional)}</span>
          </span>
          <span>
            <span className="tnum text-ink">{coin.positionCount}</span> positions
          </span>
        </div>
      </div>

      <div className="px-2 sm:px-4 py-3">
        {rows.map((bucket, i) => {
          const total = bucket.longNotional + bucket.shortNotional;
          const isMarkRow = i === markIndex;
          return (
            <div key={bucket.price}>
              {isMarkRow && <MarkLine price={coin.markPx} />}
              <div className="flex items-center gap-2 h-[9px]">
                <span className="tnum text-[9px] text-mist w-14 sm:w-16 text-right shrink-0 tabular-nums">
                  {total > 0 ? fmtPrice(bucket.price) : ""}
                </span>
                <span className="relative flex-1 h-[7px]">
                  {bucket.shortNotional > 0 && (
                    <span
                      className="absolute inset-y-0 left-0 bg-oxblood"
                      style={{ width: `${(bucket.shortNotional / max) * 100}%` }}
                    />
                  )}
                  {bucket.longNotional > 0 && (
                    <span
                      className="absolute inset-y-0 bg-teal"
                      style={{
                        left: `${(bucket.shortNotional / max) * 100}%`,
                        width: `${(bucket.longNotional / max) * 100}%`,
                      }}
                    />
                  )}
                </span>
                <span className="tnum text-[9px] text-graphite w-14 text-right shrink-0">
                  {total > 0 ? usd(total) : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {coin.peak && (
        <p className="px-4 sm:px-5 py-3 border-t border-rule text-[12px] text-graphite">
          Heaviest cluster:{" "}
          <span className="tnum text-ink">{usd(coin.peak.notional)}</span> of{" "}
          <span className={coin.peak.side === "long" ? "text-teal" : "text-oxblood"}>
            {coin.peak.side === "long" ? "longs" : "shorts"}
          </span>{" "}
          around <span className="tnum text-ink">{fmtPrice(coin.peak.price)}</span>, a{" "}
          <span className="tnum text-ink">
            {(Math.abs(coin.peak.distance) * 100).toFixed(1)}%
          </span>{" "}
          move {coin.peak.distance >= 0 ? "up" : "down"}.
        </p>
      )}
    </div>
  );
}

function MarkLine({ price }: { price: number }) {
  return (
    <div className="flex items-center gap-2 h-[13px]">
      <span className="tnum text-[9px] text-amber w-14 sm:w-16 text-right shrink-0">
        {fmtPrice(price)}
      </span>
      <span className="relative flex-1 h-px bg-amber">
        <span className="absolute -top-[5px] left-0 size-[9px] bg-amber rounded-full" />
      </span>
      <span className="eyebrow !text-[9px] !tracking-[0.1em] text-amber w-14 text-right shrink-0">
        spot
      </span>
    </div>
  );
}
