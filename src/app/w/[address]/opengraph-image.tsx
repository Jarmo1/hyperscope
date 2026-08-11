import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og";

import {
  getAllMids,
  getClearinghouseState,
  getPortfolio,
  isAddress,
  shortAddress,
  toPositions,
  type Position,
} from "@/lib/hyperliquid";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hyperliquid wallet summary";

// Palette mirrors globals.css — satori has no access to CSS variables.
const OYSTER = "#EDE9E2";
const PAPER = "#F7F5F1";
const INK = "#14181F";
const GRAPHITE = "#5C6472";
const MIST = "#8B93A1";
const RULE = "#D3CEC4";
const AMBER = "#C8720E";
const AMBER_SOFT = "#F0D9B5";
const TEAL = "#0F6B5C";
const TEAL_SOFT = "#CFE3DE";
const OXBLOOD = "#9B2226";
const OXBLOOD_SOFT = "#F0D4D2";

/**
 * Read font files off disk rather than fetching them: `import.meta.url`
 * resolves to a file:// URL under the Node runtime and undici refuses those.
 * Keeping the URL relative is still what lets the bundler trace these files
 * into the deployment.
 *
 * Two things here are load-bearing:
 *  - `.href` is passed rather than the URL object. Next also imports this
 *    module to build the page's meta tags, and in that bundle `URL` is a
 *    different realm's class, so `fileURLToPath` rejects the instance.
 *  - Loading is lazy. At module scope a throw here takes out the route's
 *    entire metadata, silently stripping every og: and twitter: tag.
 */
const loadFont = (name: string) =>
  readFile(fileURLToPath(new URL(`../../_fonts/${name}`, import.meta.url).href));

let fontsPromise: Promise<Buffer[]> | null = null;

function getFonts(): Promise<Buffer[]> {
  fontsPromise ??= Promise.all([
    loadFont("cond.woff"),
    loadFont("mono.woff"),
    loadFont("sans.woff"),
  ]);
  return fontsPromise;
}

function money(value: number, sign = false): string {
  const abs = Math.abs(value);
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${prefix}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}k`;
  return `${prefix}$${abs.toFixed(0)}`;
}

const percent = (value: number) => `${(Math.abs(value) * 100).toFixed(1)}%`;

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const [cond, mono, sans] = await getFonts();

  const fontConfig = [
    { name: "Cond", data: cond, weight: 700 as const, style: "normal" as const },
    { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
    { name: "Sans", data: sans, weight: 400 as const, style: "normal" as const },
  ];

  if (!isAddress(address)) {
    return new ImageResponse(<Fallback message="Wallet not found" />, {
      ...size,
      fonts: fontConfig,
    });
  }

  let positions: Position[] = [];
  let accountValue = 0;
  let weekPnl: number | null = null;

  try {
    const [state, mids, portfolio] = await Promise.all([
      getClearinghouseState(address),
      getAllMids(),
      getPortfolio(address).catch(() => null),
    ]);
    positions = toPositions(state, mids);
    accountValue = Number(state.marginSummary.accountValue);

    const week = portfolio?.find(([key]) => key === "week")?.[1];
    if (week && week.pnlHistory.length > 0) {
      weekPnl = Number(week.pnlHistory[week.pnlHistory.length - 1][1]);
    }
  } catch {
    return new ImageResponse(<Fallback message="Hyperliquid data unavailable" />, {
      ...size,
      fonts: fontConfig,
    });
  }

  const upnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const exposure = positions.reduce((sum, p) => sum + p.notional, 0);
  const withLiq = positions.filter((p) => p.liqDistance != null);
  const tightest =
    withLiq.length > 0
      ? withLiq.reduce((a, b) => ((a.liqDistance ?? 1) <= (b.liqDistance ?? 1) ? a : b))
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OYSTER,
          padding: 48,
          fontFamily: "Sans",
        }}
      >
        {/* Masthead */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            borderBottom: `1px solid ${RULE}`,
            paddingBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                fontFamily: "Cond",
                fontSize: 34,
                color: INK,
                letterSpacing: "-0.01em",
              }}
            >
              HYPERSCOPE
            </div>
            <div style={{ fontSize: 17, color: GRAPHITE, marginLeft: 14 }}>
              Hyperliquid risk desk
            </div>
          </div>
          <div style={{ fontFamily: "Mono", fontSize: 17, color: MIST }}>
            {shortAddress(address)}
          </div>
        </div>

        {/* Headline figures */}
        <div style={{ display: "flex", marginTop: 34 }}>
          <Figure label="Account value" value={money(accountValue)} />
          <Figure
            label="Unrealised PnL"
            value={money(upnl, true)}
            color={upnl > 0 ? TEAL : upnl < 0 ? OXBLOOD : INK}
          />
          <Figure
            label="PnL · 7 days"
            value={weekPnl != null ? money(weekPnl, true) : "—"}
            color={
              weekPnl == null ? INK : weekPnl > 0 ? TEAL : weekPnl < 0 ? OXBLOOD : INK
            }
          />
          <Figure label="Open exposure" value={money(exposure)} last />
        </div>

        {/* The signature: how close the tightest position is to zero. */}
        {tightest ? (
          <TightestPosition position={tightest} count={positions.length} />
        ) : (
          <div
            style={{
              display: "flex",
              flex: 1,
              marginTop: 30,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: PAPER,
              border: `1px solid ${RULE}`,
              fontFamily: "Cond",
              fontSize: 44,
              color: GRAPHITE,
            }}
          >
            NO OPEN POSITIONS
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${RULE}`,
            paddingTop: 14,
            fontSize: 16,
            color: GRAPHITE,
          }}
        >
          <div style={{ display: "flex" }}>Live public Hyperliquid data · read-only</div>
          <div style={{ display: "flex", color: AMBER }}>hyperscope.xyz</div>
        </div>
      </div>
    ),
    { ...size, fonts: fontConfig },
  );
}

function TightestPosition({ position: p, count }: { position: Position; count: number }) {
  const distance = p.liqDistance ?? 1;
  const critical = distance < 0.1;
  const warning = !critical && distance < 0.25;
  const tone = critical ? OXBLOOD : warning ? AMBER : TEAL;
  const soft = critical ? OXBLOOD_SOFT : warning ? AMBER_SOFT : TEAL_SOFT;

  // A depleting "room left" bar renders the worst case — a position 1% from
  // liquidation — as an invisible sliver, burying the headline fact. Filling
  // with danger instead makes that case a nearly solid bar, which is what the
  // number actually means. Scale tops out at 60% distance, beyond which the
  // position is not meaningfully at risk.
  const danger = Math.max(1.5, Math.min(100, (1 - Math.min(distance / 0.6, 1)) * 100));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        marginTop: 30,
        backgroundColor: PAPER,
        border: `1px solid ${RULE}`,
        borderLeft: `5px solid ${tone}`,
        padding: "22px 28px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 15, color: MIST, letterSpacing: "0.14em" }}>
          CLOSEST TO LIQUIDATION
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ fontSize: 16, color: GRAPHITE }}>
          {`${count} position${count === 1 ? "" : "s"} open`}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", marginTop: 12 }}>
        <div style={{ fontFamily: "Cond", fontSize: 62, color: INK }}>{p.coin}</div>
        <div
          style={{
            fontFamily: "Cond",
            fontSize: 26,
            color: p.side === "long" ? TEAL : OXBLOOD,
            marginLeft: 16,
            textTransform: "uppercase",
          }}
        >
          {`${p.side} ${p.leverage}×`}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontFamily: "Mono", fontSize: 60, color: tone, lineHeight: 1 }}>
            {percent(distance)}
          </div>
          <div style={{ fontSize: 15, color: MIST, letterSpacing: "0.14em", marginTop: 6 }}>
            TO LIQUIDATION
          </div>
        </div>
      </div>

      {/* Risk gauge: fills as the position approaches liquidation. */}
      <div
        style={{
          display: "flex",
          height: 18,
          backgroundColor: soft,
          border: `1px solid ${RULE}`,
          marginTop: 22,
        }}
      >
        <div style={{ display: "flex", width: `${danger}%`, backgroundColor: tone }} />
      </div>

      <div style={{ display: "flex", marginTop: 12, fontFamily: "Mono", fontSize: 17 }}>
        <div style={{ display: "flex", color: tone }}>
          {`liq ${p.liquidationPx != null ? p.liquidationPx.toFixed(2) : "—"}`}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", color: GRAPHITE }}>
          {`entry ${p.entryPx != null ? p.entryPx.toFixed(2) : "—"}`}
        </div>
        <div style={{ display: "flex", width: 40 }} />
        <div style={{ display: "flex", color: INK }}>
          {`mark ${p.markPx != null ? p.markPx.toFixed(2) : "—"}`}
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  color = INK,
  last = false,
}: {
  label: string;
  value: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        borderRight: last ? "none" : `1px solid ${RULE}`,
        paddingRight: 20,
      }}
    >
      <div style={{ fontSize: 15, color: MIST, letterSpacing: "0.12em" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: "Mono", fontSize: 40, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function Fallback({ message }: { message: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: OYSTER,
        fontFamily: "Cond",
      }}
    >
      <div style={{ fontSize: 56, color: INK }}>HYPERSCOPE</div>
      <div style={{ fontFamily: "Sans", fontSize: 24, color: GRAPHITE, marginTop: 12 }}>
        {message}
      </div>
    </div>
  );
}
