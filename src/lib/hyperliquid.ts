/**
 * Hyperliquid public data client.
 *
 * Everything here is keyless and free. `api.hyperliquid.xyz/info` is a single
 * POST endpoint discriminated by a `type` field; the leaderboard lives on a
 * separate stats host and is a ~34MB blob, so it gets its own slimming pass.
 */

const INFO_URL = "https://api.hyperliquid.xyz/info";
const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";

export type Window = "day" | "week" | "month" | "allTime";

export const WINDOWS: { key: Window; label: string }[] = [
  { key: "day", label: "24h" },
  { key: "week", label: "7d" },
  { key: "month", label: "30d" },
  { key: "allTime", label: "All time" },
];

/** A single open perp position as Hyperliquid reports it. */
export interface RawPosition {
  coin: string;
  szi: string; // signed size: negative is short
  entryPx: string | null;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
  leverage: { type: "cross" | "isolated"; value: number };
  cumFunding: { allTime: string; sinceOpen: string; sinceChange: string };
}

export interface ClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: { type: string; position: RawPosition }[];
  time: number;
}

export interface Fill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B";
  time: number;
  startPosition: string;
  /** e.g. "Open Long", "Close Short", "Buy", "Long > Short" */
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken?: string;
}

export interface LeaderboardRow {
  ethAddress: string;
  accountValue: string;
  displayName: string | null;
  windowPerformances: [Window, { pnl: string; roi: string; vlm: string }][];
}

/** Post a typed request to the info endpoint. */
async function info<T>(body: Record<string, unknown>, revalidate = 0): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Position data must never be cached; reference data can be.
    ...(revalidate > 0
      ? { next: { revalidate } }
      : { cache: "no-store" as const }),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid ${body.type} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getClearinghouseState(user: string) {
  return info<ClearinghouseState>({ type: "clearinghouseState", user });
}

/** Returns up to the 2000 most recent fills, newest first. */
export function getUserFills(user: string) {
  return info<Fill[]>({ type: "userFills", user });
}

export type PortfolioEntry = [
  Window | string,
  {
    accountValueHistory: [number, string][];
    pnlHistory: [number, string][];
    vlm: string;
  },
];

export function getPortfolio(user: string) {
  return info<PortfolioEntry[]>({ type: "portfolio", user });
}

/** Mid prices keyed by coin. Cheap and shared, so cache briefly. */
export function getAllMids() {
  return info<Record<string, string>>({ type: "allMids" }, 15);
}

/** Perp universe metadata (names, max leverage, decimals). */
export function getMeta() {
  return info<{ universe: { name: string; maxLeverage: number; szDecimals: number }[] }>(
    { type: "meta" },
    3600,
  );
}

/**
 * The raw leaderboard is ~34MB of JSON covering 40k+ traders. Fetching it on
 * every request would be absurd, so callers should go through the cached
 * `getLeaderboard` in `leaderboard.ts` rather than calling this directly.
 */
export async function fetchRawLeaderboard(): Promise<LeaderboardRow[]> {
  // Deliberately uncached: at ~45MB this blows Next's 2MB-per-entry data cache
  // and the failed write is pure overhead. `leaderboard.ts` caches the slimmed
  // result in memory instead.
  const res = await fetch(LEADERBOARD_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  const json = (await res.json()) as { leaderboardRows: LeaderboardRow[] };
  return json.leaderboardRows;
}

// ---------------------------------------------------------------------------
// Derived shapes the UI actually renders
// ---------------------------------------------------------------------------

export interface Position {
  coin: string;
  side: "long" | "short";
  size: number;
  entryPx: number | null;
  markPx: number | null;
  notional: number;
  unrealizedPnl: number;
  roe: number;
  leverage: number;
  leverageType: "cross" | "isolated";
  liquidationPx: number | null;
  /** How far price must move to liquidate, as a fraction of mark. */
  liqDistance: number | null;
  marginUsed: number;
  fundingSinceOpen: number;
}

export function toPositions(
  state: ClearinghouseState,
  mids: Record<string, string>,
): Position[] {
  return state.assetPositions
    .map(({ position: p }) => {
      const size = Number(p.szi);
      const markPx = mids[p.coin] != null ? Number(mids[p.coin]) : null;
      const liquidationPx = p.liquidationPx != null ? Number(p.liquidationPx) : null;
      const liqDistance =
        liquidationPx != null && markPx != null && markPx > 0
          ? Math.abs(markPx - liquidationPx) / markPx
          : null;
      return {
        coin: p.coin,
        side: size >= 0 ? ("long" as const) : ("short" as const),
        size: Math.abs(size),
        entryPx: p.entryPx != null ? Number(p.entryPx) : null,
        markPx,
        notional: Number(p.positionValue),
        unrealizedPnl: Number(p.unrealizedPnl),
        roe: Number(p.returnOnEquity),
        leverage: p.leverage.value,
        leverageType: p.leverage.type,
        liquidationPx,
        liqDistance,
        marginUsed: Number(p.marginUsed),
        fundingSinceOpen: Number(p.cumFunding.sinceOpen),
      };
    })
    .sort((a, b) => b.notional - a.notional);
}

export interface TradeStats {
  /** Number of position-closing fills with a non-zero realised PnL. */
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  realizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  biggestWin: number;
  biggestLoss: number;
  feesPaid: number;
  volume: number;
  fillCount: number;
  firstFillTime: number | null;
  lastFillTime: number | null;
  /** Realised PnL grouped by coin, best first. */
  byCoin: { coin: string; pnl: number; trades: number; volume: number }[];
}

/**
 * Hyperliquid reports realised PnL per fill on the closing side, so a "trade"
 * here means a fill that actually closed size. Opens carry closedPnl of 0 and
 * are deliberately excluded from win rate, which otherwise reads as ~50%.
 */
export function computeStats(fills: Fill[]): TradeStats {
  let wins = 0,
    losses = 0,
    realizedPnl = 0,
    grossProfit = 0,
    grossLoss = 0,
    feesPaid = 0,
    volume = 0,
    biggestWin = 0,
    biggestLoss = 0,
    closedTrades = 0;

  const coins = new Map<string, { pnl: number; trades: number; volume: number }>();

  for (const f of fills) {
    const pnl = Number(f.closedPnl);
    const notional = Number(f.px) * Number(f.sz);
    volume += notional;
    feesPaid += Number(f.fee);

    const entry = coins.get(f.coin) ?? { pnl: 0, trades: 0, volume: 0 };
    entry.volume += notional;

    if (pnl !== 0) {
      closedTrades++;
      realizedPnl += pnl;
      entry.pnl += pnl;
      entry.trades++;
      if (pnl > 0) {
        wins++;
        grossProfit += pnl;
        biggestWin = Math.max(biggestWin, pnl);
      } else {
        losses++;
        grossLoss += Math.abs(pnl);
        biggestLoss = Math.min(biggestLoss, pnl);
      }
    }
    coins.set(f.coin, entry);
  }

  const times = fills.map((f) => f.time);

  return {
    closedTrades,
    wins,
    losses,
    winRate: closedTrades > 0 ? wins / closedTrades : null,
    realizedPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin: wins > 0 ? grossProfit / wins : 0,
    avgLoss: losses > 0 ? -grossLoss / losses : 0,
    biggestWin,
    biggestLoss,
    feesPaid,
    volume,
    fillCount: fills.length,
    firstFillTime: times.length ? Math.min(...times) : null,
    lastFillTime: times.length ? Math.max(...times) : null,
    byCoin: [...coins.entries()]
      .map(([coin, v]) => ({ coin, ...v }))
      .sort((a, b) => b.pnl - a.pnl),
  };
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
