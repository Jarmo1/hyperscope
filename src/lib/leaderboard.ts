import { fetchRawLeaderboard, type LeaderboardRow, type Window } from "./hyperliquid";

/**
 * The upstream leaderboard is a single ~34MB JSON document with 40k+ traders.
 * Two consequences shape this module:
 *
 *  1. It is far too large for Vercel's data cache (2MB/entry), so the fetch is
 *     uncached and we hold a *slimmed* copy in module memory instead.
 *  2. Parsing it is expensive, so we serve stale data while refreshing in the
 *     background rather than making a request wait on a refetch.
 */

export interface Trader {
  address: string;
  displayName: string | null;
  accountValue: number;
  perf: Record<Window, { pnl: number; roi: number; vlm: number }>;
}

/** Only traders above this account value are kept; below it the data is noise. */
const MIN_ACCOUNT_VALUE = 10_000;
const TTL_MS = 30 * 60 * 1000;

interface CacheState {
  traders: Trader[];
  fetchedAt: number;
}

let cache: CacheState | null = null;
let inflight: Promise<CacheState> | null = null;

function slim(rows: LeaderboardRow[]): Trader[] {
  const out: Trader[] = [];
  for (const row of rows) {
    const accountValue = Number(row.accountValue);
    if (!Number.isFinite(accountValue) || accountValue < MIN_ACCOUNT_VALUE) continue;

    const perf = {} as Trader["perf"];
    for (const [window, p] of row.windowPerformances) {
      perf[window] = { pnl: Number(p.pnl), roi: Number(p.roi), vlm: Number(p.vlm) };
    }
    out.push({
      address: row.ethAddress,
      displayName: row.displayName || null,
      accountValue,
      perf,
    });
  }
  return out;
}

async function refresh(): Promise<CacheState> {
  const rows = await fetchRawLeaderboard();
  const state: CacheState = { traders: slim(rows), fetchedAt: Date.now() };
  cache = state;
  return state;
}

/**
 * Returns the slimmed leaderboard. Blocks only on a cold cache; once warm, an
 * expired entry is served immediately and refreshed behind the request.
 */
export async function getLeaderboard(): Promise<Trader[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.traders;

  if (cache) {
    if (!inflight) {
      inflight = refresh().finally(() => {
        inflight = null;
      });
      // A background refresh failure must not surface as an unhandled rejection.
      inflight.catch(() => {});
    }
    return cache.traders;
  }

  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  return (await inflight).traders;
}

export interface LeaderboardQuery {
  window: Window;
  sort: "pnl" | "roi" | "vlm" | "accountValue";
  minAccountValue?: number;
  maxAccountValue?: number;
  minVolume?: number;
  /**
   * Window volume as a multiple of current account value. A return of several
   * hundred percent on less volume than the account holds cannot come from
   * trading, so a floor of 1 drops the arithmetically impossible rows without
   * pretending we can detect deposits in general.
   */
  minTurnover?: number;
  limit?: number;
}

/** Window volume divided by current account value. */
export function turnoverOf(trader: Trader, window: Window): number | null {
  const perf = trader.perf[window];
  if (!perf || trader.accountValue <= 0) return null;
  return perf.vlm / trader.accountValue;
}

/**
 * Hyperliquid's own leaderboard only sorts by PnL, which is dominated by the
 * handful of accounts large enough that ROI is irrelevant. Filtering by account
 * size and requiring real volume is what surfaces traders worth copying.
 */
export async function queryLeaderboard(q: LeaderboardQuery): Promise<Trader[]> {
  const traders = await getLeaderboard();
  const {
    window,
    sort,
    minAccountValue = 0,
    maxAccountValue = Infinity,
    minVolume = 0,
    minTurnover = 0,
    limit = 100,
  } = q;

  return traders
    .filter((t) => {
      if (t.accountValue < minAccountValue || t.accountValue > maxAccountValue) return false;
      const p = t.perf[window];
      if (!p) return false;
      if (p.vlm < minVolume) return false;
      if (minTurnover > 0) {
        const turnover = turnoverOf(t, window);
        if (turnover == null || turnover < minTurnover) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "accountValue") return b.accountValue - a.accountValue;
      return (b.perf[window]?.[sort] ?? 0) - (a.perf[window]?.[sort] ?? 0);
    })
    .slice(0, limit);
}

export async function getTrader(address: string): Promise<Trader | null> {
  const traders = await getLeaderboard();
  const lower = address.toLowerCase();
  return traders.find((t) => t.address.toLowerCase() === lower) ?? null;
}
