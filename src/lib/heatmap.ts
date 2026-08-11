import {
  getAllMids,
  getClearinghouseState,
  toPositions,
  type Position,
} from "./hyperliquid";
import { getLeaderboard } from "./leaderboard";
import { pooled } from "./pool";
import { sharedState } from "./shared-state";

/**
 * Where liquidations are stacked.
 *
 * Every open position publishes its own liquidation price. Nobody aggregates
 * them, so nobody can see that (say) $180M of longs unwind between $58k and
 * $60k — which is exactly the level price tends to get dragged toward. This is
 * the one number here worth posting daily, and it is the reason the site has
 * anything to say when you have no particular wallet in mind.
 */

/**
 * Coverage is scanned in rolling slices rather than one sweep.
 *
 * Measured behaviour: a burst of 400 `clearinghouseState` calls completes in
 * ~6s and costs 800 weight, which fits inside Hyperliquid's ~1200/min budget.
 * Pushing 2500 in one go throttles roughly a fifth of them. So each slice is
 * capped at 400 and slices are spaced a minute apart, while results accumulate
 * into a shared snapshot — coverage builds toward the full pool over a few
 * minutes instead of demanding it all at once.
 *
 * Depth matters: 400 accounts yields ~11 chartable BTC positions, while ~2000
 * yields ~65 and four times the notional.
 */
const POOL_SIZE = 2400;
const SLICE_SIZE = 400;
const SLICE_INTERVAL_MS = 60 * 1000;
const ENTRY_TTL_MS = 30 * 60 * 1000;
const CONCURRENCY = 12;

/** Price band around mark that the map covers, and its resolution. */
const BAND = 0.35;
/**
 * 28 rather than 40: the share card has roughly 330px of vertical room, so 40
 * rows cannot be drawn above ~8px each without labels colliding and the last
 * rows clipping. Fewer, taller buckets also concentrate sparse data into
 * readable clusters instead of scattering it across mostly empty rows.
 */
const BUCKETS = 28;

/** Coins need a minimum number of distinct positions to be worth charting. */
const MIN_POSITIONS = 5;

export interface Bucket {
  /** Lower edge of the price bucket. */
  price: number;
  /** Notional that liquidates here because longs got wiped out. */
  longNotional: number;
  /** Notional that liquidates here because shorts got wiped out. */
  shortNotional: number;
  positions: number;
}

export interface CoinHeatmap {
  coin: string;
  markPx: number;
  buckets: Bucket[];
  /** Total notional at risk inside the charted band. */
  totalNotional: number;
  longNotional: number;
  shortNotional: number;
  positionCount: number;
  /** The single heaviest cluster in the band — the headline. */
  peak: {
    price: number;
    notional: number;
    side: "long" | "short";
    /** Move from mark to reach it, signed. */
    distance: number;
  } | null;
}

export interface Heatmap {
  coins: CoinHeatmap[];
  /** Accounts currently represented in the snapshot. */
  walletsScanned: number;
  /** How much of the candidate pool has been covered, 0–1. */
  coverage: number;
  /** Total notional across every scanned position, charted or not. */
  coveredNotional: number;
  generatedAt: number;
}

interface Entry {
  positions: Position[];
  at: number;
}

/** Shared across route bundles — see shared-state.ts for why that matters. */
const state = sharedState("heatmap", () => ({
  snapshot: new Map<string, Entry>(),
  sliceCursor: 0,
  lastSliceAt: 0,
  sliceInflight: null as Promise<void> | null,
}));

function build(
  positionsByCoin: Map<string, Position[]>,
  mids: Record<string, string>,
): CoinHeatmap[] {
  const out: CoinHeatmap[] = [];

  for (const [coin, positions] of positionsByCoin) {
    const markPx = mids[coin] != null ? Number(mids[coin]) : null;
    if (markPx == null || !Number.isFinite(markPx) || markPx <= 0) continue;

    const inBand = positions.filter((p) => {
      if (p.liquidationPx == null || p.liquidationPx <= 0) return false;
      const move = Math.abs(p.liquidationPx - markPx) / markPx;
      return move <= BAND;
    });
    if (inBand.length < MIN_POSITIONS) continue;

    const lo = markPx * (1 - BAND);
    const hi = markPx * (1 + BAND);
    const step = (hi - lo) / BUCKETS;

    const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
      price: lo + i * step,
      longNotional: 0,
      shortNotional: 0,
      positions: 0,
    }));

    for (const p of inBand) {
      const index = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor((p.liquidationPx! - lo) / step)),
      );
      const bucket = buckets[index];
      if (p.side === "long") bucket.longNotional += p.notional;
      else bucket.shortNotional += p.notional;
      bucket.positions++;
    }

    const longNotional = inBand
      .filter((p) => p.side === "long")
      .reduce((sum, p) => sum + p.notional, 0);
    const shortNotional = inBand
      .filter((p) => p.side === "short")
      .reduce((sum, p) => sum + p.notional, 0);

    let peak: CoinHeatmap["peak"] = null;
    for (const b of buckets) {
      const notional = b.longNotional + b.shortNotional;
      if (notional <= 0) continue;
      if (peak == null || notional > peak.notional) {
        peak = {
          price: b.price + step / 2,
          notional,
          side: b.longNotional >= b.shortNotional ? "long" : "short",
          distance: (b.price + step / 2 - markPx) / markPx,
        };
      }
    }

    out.push({
      coin,
      markPx,
      buckets,
      totalNotional: longNotional + shortNotional,
      longNotional,
      shortNotional,
      positionCount: inBand.length,
      peak,
    });
  }

  return out.sort((a, b) => b.totalNotional - a.totalNotional);
}

/** Scan the next slice of the candidate pool and merge it into the snapshot. */
async function scanSlice(): Promise<void> {
  const [traders, mids] = await Promise.all([getLeaderboard(), getAllMids()]);

  const pool = [...traders]
    .sort((a, b) => b.accountValue - a.accountValue)
    .slice(0, POOL_SIZE);
  if (pool.length === 0) return;

  const start = state.sliceCursor % pool.length;
  const slice = [
    ...pool.slice(start, start + SLICE_SIZE),
    // Wrap around so the cursor keeps cycling the whole pool.
    ...(start + SLICE_SIZE > pool.length
      ? pool.slice(0, start + SLICE_SIZE - pool.length)
      : []),
  ];

  state.sliceCursor = (start + SLICE_SIZE) % pool.length;
  state.lastSliceAt = Date.now();

  const results = await pooled(slice, CONCURRENCY, async (t) => {
    // Named distinctly so it cannot shadow the shared `state` container above.
    const clearinghouse = await getClearinghouseState(t.address);
    return { address: t.address, positions: toPositions(clearinghouse, mids) };
  });

  const now = Date.now();
  for (const result of results) {
    if (!result) continue;
    state.snapshot.set(result.address, { positions: result.positions, at: now });
  }

  for (const [address, entry] of state.snapshot) {
    if (now - entry.at > ENTRY_TTL_MS) state.snapshot.delete(address);
  }
}

function ensureFreshness(): Promise<void> | null {
  if (Date.now() - state.lastSliceAt < SLICE_INTERVAL_MS) return null;
  state.sliceInflight ??= scanSlice().finally(() => {
    state.sliceInflight = null;
  });
  return state.sliceInflight;
}

export async function getHeatmap(): Promise<Heatmap> {
  const pending = ensureFreshness();

  // Only block when there is nothing to show yet; otherwise the snapshot is
  // served immediately and the slice lands for the next caller.
  if (state.snapshot.size === 0 && pending) {
    await pending.catch(() => {});
  } else {
    pending?.catch(() => {});
  }

  const mids = await getAllMids();
  const positionsByCoin = new Map<string, Position[]>();
  let coveredNotional = 0;

  for (const entry of state.snapshot.values()) {
    for (const p of entry.positions) {
      coveredNotional += p.notional;
      const list = positionsByCoin.get(p.coin);
      if (list) list.push(p);
      else positionsByCoin.set(p.coin, [p]);
    }
  }

  return {
    coins: build(positionsByCoin, mids),
    walletsScanned: state.snapshot.size,
    coverage: Math.min(1, state.snapshot.size / POOL_SIZE),
    coveredNotional,
    generatedAt: Date.now(),
  };
}

export function getCoinHeatmap(heatmap: Heatmap, coin: string): CoinHeatmap | null {
  const upper = coin.toUpperCase();
  return heatmap.coins.find((c) => c.coin.toUpperCase() === upper) ?? null;
}
