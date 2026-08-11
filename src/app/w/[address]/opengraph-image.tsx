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
import { CARD, loadCardFonts, money, percentText, priceText } from "@/lib/card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hyperliquid wallet summary";

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const fontConfig = await loadCardFonts();

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
          backgroundColor: CARD.oyster,
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
            borderBottom: `1px solid ${CARD.rule}`,
            paddingBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div
              style={{
                fontFamily: "Cond",
                fontSize: 34,
                color: CARD.ink,
                letterSpacing: "-0.01em",
              }}
            >
              HYPERSCOPE
            </div>
            <div style={{ fontSize: 17, color: CARD.graphite, marginLeft: 14 }}>
              Hyperliquid risk desk
            </div>
          </div>
          <div style={{ fontFamily: "Mono", fontSize: 17, color: CARD.mist }}>
            {shortAddress(address)}
          </div>
        </div>

        {/* Headline figures */}
        <div style={{ display: "flex", marginTop: 34 }}>
          <Figure label="Account value" value={money(accountValue)} />
          <Figure
            label="Unrealised PnL"
            value={money(upnl, true)}
            color={upnl > 0 ? CARD.teal : upnl < 0 ? CARD.oxblood : CARD.ink}
          />
          <Figure
            label="PnL · 7 days"
            value={weekPnl != null ? money(weekPnl, true) : "—"}
            color={
              weekPnl == null ? CARD.ink : weekPnl > 0 ? CARD.teal : weekPnl < 0 ? CARD.oxblood : CARD.ink
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
              backgroundColor: CARD.paper,
              border: `1px solid ${CARD.rule}`,
              fontFamily: "Cond",
              fontSize: 44,
              color: CARD.graphite,
            }}
          >
            NO OPEN POSITIONS
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${CARD.rule}`,
            paddingTop: 14,
            fontSize: 16,
            color: CARD.graphite,
          }}
        >
          <div style={{ display: "flex" }}>Live public Hyperliquid data · read-only</div>
          <div style={{ display: "flex", color: CARD.amber }}>hyperscope.xyz</div>
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
  const tone = critical ? CARD.oxblood : warning ? CARD.amber : CARD.teal;
  const soft = critical ? CARD.oxbloodSoft : warning ? CARD.amberSoft : CARD.tealSoft;

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
        backgroundColor: CARD.paper,
        border: `1px solid ${CARD.rule}`,
        borderLeft: `5px solid ${tone}`,
        padding: "22px 28px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 15, color: CARD.mist, letterSpacing: "0.14em" }}>
          CLOSEST TO LIQUIDATION
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ fontSize: 16, color: CARD.graphite }}>
          {`${count} position${count === 1 ? "" : "s"} open`}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", marginTop: 12 }}>
        <div style={{ fontFamily: "Cond", fontSize: 62, color: CARD.ink }}>{p.coin}</div>
        <div
          style={{
            fontFamily: "Cond",
            fontSize: 26,
            color: p.side === "long" ? CARD.teal : CARD.oxblood,
            marginLeft: 16,
            textTransform: "uppercase",
          }}
        >
          {`${p.side} ${p.leverage}×`}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontFamily: "Mono", fontSize: 60, color: tone, lineHeight: 1 }}>
            {percentText(distance)}
          </div>
          <div style={{ fontSize: 15, color: CARD.mist, letterSpacing: "0.14em", marginTop: 6 }}>
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
          border: `1px solid ${CARD.rule}`,
          marginTop: 22,
        }}
      >
        <div style={{ display: "flex", width: `${danger}%`, backgroundColor: tone }} />
      </div>

      <div style={{ display: "flex", marginTop: 12, fontFamily: "Mono", fontSize: 17 }}>
        {/* priceText keeps precision on sub-dollar coins, where a fixed two
            decimals would render every level as 0.00. */}
        <div style={{ display: "flex", color: tone }}>
          {`liq ${p.liquidationPx != null ? priceText(p.liquidationPx) : "—"}`}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", color: CARD.graphite }}>
          {`entry ${p.entryPx != null ? priceText(p.entryPx) : "—"}`}
        </div>
        <div style={{ display: "flex", width: 40 }} />
        <div style={{ display: "flex", color: CARD.ink }}>
          {`mark ${p.markPx != null ? priceText(p.markPx) : "—"}`}
        </div>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  color = CARD.ink,
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
        borderRight: last ? "none" : `1px solid ${CARD.rule}`,
        paddingRight: 20,
      }}
    >
      <div style={{ fontSize: 15, color: CARD.mist, letterSpacing: "0.12em" }}>
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
        backgroundColor: CARD.oyster,
        fontFamily: "Cond",
      }}
    >
      <div style={{ fontSize: 56, color: CARD.ink }}>HYPERSCOPE</div>
      <div style={{ fontFamily: "Sans", fontSize: 24, color: CARD.graphite, marginTop: 12 }}>
        {message}
      </div>
    </div>
  );
}
