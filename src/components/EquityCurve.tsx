import { usd } from "@/lib/format";

/**
 * Account value over the selected window. Drawn as a plain area chart with a
 * single hairline — the sheet's one piece of shape, kept deliberately quiet so
 * the ladders stay the loudest thing on the page.
 */
export function EquityCurve({
  history,
  label,
}: {
  history: [number, string][];
  label: string;
}) {
  const points = history
    .map(([time, value]) => ({ time, value: Number(value) }))
    .filter((p) => Number.isFinite(p.value));

  if (points.length < 2) {
    return (
      <div className="sheet px-4 sm:px-5 py-6 text-sm text-graphite">
        Not enough history to chart {label}.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || Math.max(hi * 0.01, 1);

  const W = 1000;
  const H = 180;
  const PAD = 8;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = PAD + (1 - (p.value - lo) / range) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const up = last >= first;
  const stroke = up ? "var(--color-teal)" : "var(--color-oxblood)";
  const fill = up ? "var(--color-teal-soft)" : "var(--color-oxblood-soft)";

  return (
    <div className="sheet">
      <div className="flex items-baseline justify-between gap-4 px-4 sm:px-5 py-3 border-b border-rule">
        <h2 className="eyebrow">Account value · {label}</h2>
        <div className="flex items-baseline gap-4 text-[11px] text-graphite">
          <span>
            low <span className="tnum text-ink">{usd(lo)}</span>
          </span>
          <span>
            high <span className="tnum text-ink">{usd(hi)}</span>
          </span>
        </div>
      </div>
      <div className="px-1 pt-2 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[140px] sm:h-[180px]"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Account value over ${label}, from ${usd(first)} to ${usd(last)}`}
        >
          <path d={area} fill={fill} opacity="0.6" />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
