import { getHeatmap, type CoinHeatmap } from "./heatmap";
import { getRiskBoard } from "./riskboard";
import { shortAddress } from "./hyperliquid";

/**
 * Picks the single most postable fact on the exchange right now.
 *
 * The growth loop is content, not advertising: nobody reposts "try my
 * dashboard", but a specific, checkable number about someone else's money
 * travels on its own. Each story carries a stable `key` so the scheduler can
 * refuse to post the same fact twice.
 */

export type StoryKind = "liquidation-risk" | "liquidation-cluster";

export interface Story {
  kind: StoryKind;
  /** Stable identity for deduping. Changes only when the fact changes. */
  key: string;
  text: string;
  /** Page the post should link to. */
  path: string;
  /** How newsworthy this is, for choosing between candidates. */
  score: number;
}

function usdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}k`;
  return `$${abs.toFixed(0)}`;
}

const priceFmt = (value: number) =>
  value >= 1000
    ? value.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : value.toFixed(value >= 1 ? 2 : 4);

/** A large account sitting very close to its liquidation price. */
async function riskStory(): Promise<Story | null> {
  const board = await getRiskBoard();

  // Only accounts with real money on the line are worth posting about.
  const candidate = board.find(
    (e) => e.tightest.liqDistance != null && e.tightest.notional >= 1_000_000,
  );
  if (!candidate) return null;

  const p = candidate.tightest;
  const distance = p.liqDistance!;
  if (distance > 0.05) return null; // Not close enough to be a story.

  const pctText = `${(distance * 100).toFixed(1)}%`;
  const text = [
    `A ${usdCompact(candidate.accountValue)} account is ${pctText} from liquidation on Hyperliquid.`,
    ``,
    `${p.coin} ${p.side} · ${p.leverage}× · ${usdCompact(p.notional)} notional`,
    `Liquidation ${priceFmt(p.liquidationPx!)} · mark ${priceFmt(p.markPx ?? 0)}`,
  ].join("\n");

  return {
    kind: "liquidation-risk",
    key: `risk:${candidate.address}:${p.coin}:${pctText}`,
    text,
    path: `/w/${candidate.address}`,
    // Closer to the line and more money on it both raise the score.
    score: (0.05 - distance) * 2000 + Math.log10(p.notional),
  };
}

/** The heaviest stack of liquidations sitting near a coin's current price. */
function clusterStoryFrom(coin: CoinHeatmap): Story | null {
  if (!coin.peak) return null;
  const { peak } = coin;
  if (peak.notional < 5_000_000) return null;

  const direction = peak.distance >= 0 ? "above" : "below";
  const movePct = `${(Math.abs(peak.distance) * 100).toFixed(1)}%`;
  const sideWord = peak.side === "long" ? "longs" : "shorts";

  const text = [
    `${usdCompact(peak.notional)} of ${coin.coin} ${sideWord} liquidate around ${priceFmt(peak.price)} — ${movePct} ${direction} spot.`,
    ``,
    `${usdCompact(coin.totalNotional)} sits within 35% of mark (${priceFmt(coin.markPx)}).`,
  ].join("\n");

  return {
    kind: "liquidation-cluster",
    key: `cluster:${coin.coin}:${priceFmt(peak.price)}:${usdCompact(peak.notional)}`,
    text,
    path: `/heat/${coin.coin.toLowerCase()}`,
    // Nearby clusters matter more than distant ones.
    score: Math.log10(peak.notional) * 2 + (0.35 - Math.abs(peak.distance)) * 10,
  };
}

async function clusterStories(): Promise<Story[]> {
  const heatmap = await getHeatmap();
  return heatmap.coins
    .map(clusterStoryFrom)
    .filter((s): s is Story => s !== null);
}

/** Best available story, or null when nothing is worth saying. */
export async function pickStory(): Promise<Story | null> {
  const [risk, clusters] = await Promise.all([
    riskStory().catch(() => null),
    clusterStories().catch(() => [] as Story[]),
  ]);

  const candidates = [risk, ...clusters].filter((s): s is Story => s !== null);
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.score - a.score)[0];
}

export { shortAddress };
