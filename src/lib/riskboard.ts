import {
  getAllMids,
  getClearinghouseState,
  toPositions,
  type Position,
} from "./hyperliquid";
import { getLeaderboard, type Trader } from "./leaderboard";
import { pooled } from "./pool";
import { sharedState } from "./shared-state";

/**
 * The front page: which large accounts are closest to being liquidated right
 * now. Hyperliquid publishes every input for this and nobody assembles it, so
 * it is both the hook and the thing worth screenshotting.
 */

export interface RiskEntry {
  address: string;
  displayName: string | null;
  accountValue: number;
  /** The single position nearest its liquidation price. */
  tightest: Position;
  positionCount: number;
  totalNotional: number;
  totalUpnl: number;
}

/**
 * Candidate selection matters more than scan size. Ranking by account value
 * surfaces the whales, but whales run low leverage — their tightest positions
 * sit 50%+ from liquidation, which is not a risk board. Ranking by recent
 * volume surfaces the accounts actually trading with leverage on, which is
 * where positions genuinely near the line live.
 */
const SCAN_SIZE = 180;
const MIN_ACCOUNT_VALUE = 100_000;
const CONCURRENCY = 10;
const TTL_MS = 90 * 1000;

/** Shared across route bundles — see shared-state.ts. */
const state = sharedState("riskboard", () => ({
  cache: null as { entries: RiskEntry[]; fetchedAt: number } | null,
  inflight: null as Promise<RiskEntry[]> | null,
}));

async function build(): Promise<RiskEntry[]> {
  const [traders, mids] = await Promise.all([getLeaderboard(), getAllMids()]);

  const candidates: Trader[] = traders
    .filter((t) => t.accountValue >= MIN_ACCOUNT_VALUE && (t.perf.week?.vlm ?? 0) > 0)
    .sort((a, b) => (b.perf.week?.vlm ?? 0) - (a.perf.week?.vlm ?? 0))
    .slice(0, SCAN_SIZE);

  const states = await pooled(candidates, CONCURRENCY, async (t) => {
    const state = await getClearinghouseState(t.address);
    return { trader: t, positions: toPositions(state, mids) };
  });

  const entries: RiskEntry[] = [];
  for (const result of states) {
    if (!result) continue;
    const { trader, positions } = result;

    // Only positions with a real liquidation price can be ranked by risk.
    const liquidatable = positions.filter(
      (p) => p.liqDistance != null && p.notional > 0,
    );
    if (liquidatable.length === 0) continue;

    const tightest = liquidatable.reduce((a, b) =>
      (a.liqDistance ?? 1) <= (b.liqDistance ?? 1) ? a : b,
    );

    entries.push({
      address: trader.address,
      displayName: trader.displayName,
      accountValue: trader.accountValue,
      tightest,
      positionCount: positions.length,
      totalNotional: positions.reduce((sum, p) => sum + p.notional, 0),
      totalUpnl: positions.reduce((sum, p) => sum + p.unrealizedPnl, 0),
    });
  }

  return entries.sort(
    (a, b) => (a.tightest.liqDistance ?? 1) - (b.tightest.liqDistance ?? 1),
  );
}

export async function getRiskBoard(): Promise<RiskEntry[]> {
  const { cache } = state;
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.entries;

  state.inflight ??= build()
    .then((entries) => {
      state.cache = { entries, fetchedAt: Date.now() };
      return entries;
    })
    .finally(() => {
      state.inflight = null;
    });

  try {
    return await state.inflight;
  } catch {
    // A failed rebuild should serve stale data rather than break the page.
    return cache?.entries ?? [];
  }
}
