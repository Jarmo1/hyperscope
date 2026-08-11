import type { Position } from "@/lib/hyperliquid";
import { price } from "@/lib/format";

/**
 * The signature element: one position drawn on a true price scale, with
 * liquidation, entry and mark plotted in proportion. The shaded span between
 * mark and liquidation is the buffer — how far price can move before the
 * position is gone. Its width is the risk, read at a glance.
 */

type Severity = "critical" | "warning" | "clear";

export function severityOf(liqDistance: number | null): Severity {
  if (liqDistance == null) return "clear";
  if (liqDistance < 0.1) return "critical";
  if (liqDistance < 0.25) return "warning";
  return "clear";
}

const BUFFER_FILL: Record<Severity, string> = {
  critical: "bg-oxblood-soft",
  warning: "bg-amber-soft",
  clear: "bg-teal-soft",
};

const LIQ_TICK: Record<Severity, string> = {
  critical: "bg-oxblood",
  warning: "bg-amber",
  clear: "bg-rule-strong",
};

export function LiqLadder({ position }: { position: Position }) {
  const { liquidationPx, entryPx, markPx, side, liqDistance } = position;
  const severity = severityOf(liqDistance);

  const reference = markPx ?? entryPx;
  if (reference == null) {
    return <div className="h-9 flex items-center text-[11px] text-mist">No price data</div>;
  }

  // Without a liquidation price there is no buffer to draw, only entry vs mark.
  if (liquidationPx == null) {
    return (
      <div className="h-9 flex items-center gap-2 text-[11px] text-graphite">
        <span className="h-px flex-1 bg-rule" />
        <span className="eyebrow !text-[10px] !tracking-[0.1em] text-mist">
          No liquidation price — margin covers this position
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>
    );
  }

  const points = [liquidationPx, reference, entryPx ?? reference];
  const rawLo = Math.min(...points);
  const rawHi = Math.max(...points);
  const pad = Math.max((rawHi - rawLo) * 0.12, rawHi * 0.002);
  const lo = rawLo - pad;
  const hi = rawHi + pad;
  const span = hi - lo || 1;

  const at = (value: number) => ((value - lo) / span) * 100;

  const liqAt = at(liquidationPx);
  const markAt = at(reference);
  const entryAt = entryPx != null ? at(entryPx) : null;

  const bufferLeft = Math.min(liqAt, markAt);
  const bufferWidth = Math.abs(markAt - liqAt);

  // Long positions liquidate below; shorts above. Orienting the caption to the
  // real direction stops the ladder reading backwards on shorts.
  const liqSideLabel = side === "long" ? "liq below" : "liq above";

  return (
    <div className="pt-3 pb-1">
      <div className="relative h-9">
        {/* Baseline */}
        <div className="absolute inset-x-0 top-4 h-px bg-rule" />

        {/* Buffer: the distance price must travel to wipe this position out. */}
        <div
          className={`ladder-track absolute top-[13px] h-[5px] ${BUFFER_FILL[severity]}`}
          style={{ left: `${bufferLeft}%`, width: `${bufferWidth}%` }}
        />

        {/* Liquidation tick */}
        <div
          className={`absolute top-[7px] h-4 w-[2px] ${LIQ_TICK[severity]}`}
          style={{ left: `${liqAt}%` }}
        />

        {/* Entry tick — dashed, secondary: where they got in. */}
        {entryAt != null && (
          <div
            className="absolute top-[10px] h-[10px] w-px bg-graphite opacity-60"
            style={{ left: `${entryAt}%` }}
          />
        )}

        {/* Mark: the live price, the only filled marker. */}
        <div
          className="absolute top-[11px] size-[9px] rounded-full bg-ink ring-2 ring-paper"
          style={{ left: `calc(${markAt}% - 4.5px)` }}
        />

        {/* Labels sit under their own ticks, edge-clamped so they never clip. */}
        <LadderLabel at={liqAt} tone="liq" severity={severity}>
          {price(liquidationPx)}
        </LadderLabel>
        <LadderLabel at={markAt} tone="mark">
          {price(reference)}
        </LadderLabel>
      </div>

      <div className="flex justify-between text-[10px] text-mist mt-0.5">
        <span className="eyebrow !text-[10px] !tracking-[0.1em] !font-400">
          {liqSideLabel}
        </span>
        {entryPx != null && (
          <span className="tnum">entry {price(entryPx)}</span>
        )}
      </div>
    </div>
  );
}

function LadderLabel({
  at,
  tone,
  severity = "clear",
  children,
}: {
  at: number;
  tone: "liq" | "mark";
  severity?: Severity;
  children: React.ReactNode;
}) {
  const color =
    tone === "mark"
      ? "text-ink"
      : severity === "critical"
        ? "text-oxblood"
        : severity === "warning"
          ? "text-amber"
          : "text-graphite";

  // Clamp the anchor so labels near either end stay inside the track.
  const clamped = Math.min(Math.max(at, 6), 94);
  return (
    <span
      className={`tnum absolute top-[23px] text-[10px] ${color} whitespace-nowrap`}
      style={{ left: `${clamped}%`, transform: "translateX(-50%)" }}
    >
      {children}
    </span>
  );
}
