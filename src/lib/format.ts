/** Compact money: $1.2M, $840k, $1,204. Sign is caller's business unless asked. */
export function usd(value: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const { sign = false, decimals } = opts;
  const abs = Math.abs(value);
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";

  let body: string;
  if (abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(2)}M`;
  else if (abs >= 10_000) body = `${(abs / 1_000).toFixed(1)}k`;
  else
    body = abs.toLocaleString("en-US", {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
    });

  return `${prefix}$${body}`;
}

/** Price formatting that keeps precision on sub-dollar coins. */
export function price(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function pct(value: number | null, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const { sign = false, decimals = 1 } = opts;
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${Math.abs(value * 100).toFixed(decimals)}%`;
}

export function compactNum(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

export function timeAgo(ms: number | null): string {
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Semantic colour class for a signed value. */
export function pnlClass(value: number): string {
  if (value > 0) return "text-teal";
  if (value < 0) return "text-oxblood";
  return "text-graphite";
}
