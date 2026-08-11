import { ImageResponse } from "next/og";

import { getCoinHeatmap, getHeatmap, type CoinHeatmap } from "@/lib/heatmap";
import { loadCardFonts, CARD, money, priceText } from "@/lib/card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Hyperliquid liquidation map";

export default async function Image({ params }: { params: Promise<{ coin: string }> }) {
  const { coin } = await params;
  const fonts = await loadCardFonts();

  let data: CoinHeatmap | null = null;
  try {
    data = getCoinHeatmap(await getHeatmap(), coin);
  } catch {
    data = null;
  }

  if (!data) {
    return new ImageResponse(
      (
        <div style={CARD.fallback}>
          <div style={{ fontFamily: "Cond", fontSize: 56, color: CARD.ink }}>
            HYPERSCOPE
          </div>
          <div style={{ fontSize: 24, color: CARD.graphite, marginTop: 12 }}>
            {`Not enough ${coin.toUpperCase()} data yet`}
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  // Highest price at the top, matching the on-page profile.
  const all = [...data.buckets].reverse();
  const markAt = all.findIndex((b) => b.price <= data.markPx);

  /**
   * Crop to the populated price range rather than drawing all 28 buckets.
   * Empty edge rows are pure padding, and satori renders rows slightly taller
   * than declared, so the full set overflows the card and clips the lowest
   * levels. Cropping fits the space and concentrates the chart on real data.
   */
  const occupied = all
    .map((b, i) => (b.longNotional + b.shortNotional > 0 ? i : -1))
    .filter((i) => i >= 0);

  const first = Math.max(0, Math.min(occupied[0] ?? 0, markAt) - 1);
  const last = Math.min(
    all.length - 1,
    Math.max(occupied[occupied.length - 1] ?? all.length - 1, markAt) + 1,
  );

  /**
   * Hard cap on rows. Cropping alone is not enough — once coverage is good
   * almost every bucket is populated, and satori renders rows taller than
   * declared, so an uncapped profile overflows and clips the lowest levels.
   * 22 rows centred on spot always fits the space the card has left.
   */
  const MAX_ROWS = 22;
  const cropped = all.slice(first, last + 1);
  const croppedMark = markAt - first;

  const windowStart =
    cropped.length <= MAX_ROWS
      ? 0
      : Math.max(
          0,
          Math.min(croppedMark - Math.floor(MAX_ROWS / 2), cropped.length - MAX_ROWS),
        );

  const rows = cropped.slice(windowStart, windowStart + MAX_ROWS);
  const max = Math.max(...rows.map((b) => b.longNotional + b.shortNotional), 1);
  const markIndex = croppedMark - windowStart;

  return new ImageResponse(
    (
      <div style={CARD.page}>
        <div style={CARD.masthead}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ fontFamily: "Cond", fontSize: 34, color: CARD.ink }}>
              HYPERSCOPE
            </div>
            <div style={{ fontSize: 17, color: CARD.graphite, marginLeft: 14 }}>
              Liquidation map
            </div>
          </div>
          <div style={{ fontFamily: "Mono", fontSize: 17, color: CARD.mist }}>
            {`${data.positionCount} positions observed`}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 14, alignItems: "flex-end" }}>
          <div style={{ fontFamily: "Cond", fontSize: 62, color: CARD.ink, lineHeight: 1 }}>
            {data.coin}
          </div>
          <div
            style={{
              fontFamily: "Mono",
              fontSize: 22,
              color: CARD.graphite,
              marginLeft: 18,
              marginBottom: 8,
            }}
          >
            {`spot ${priceText(data.markPx)}`}
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: "Mono", fontSize: 34, color: CARD.ink, lineHeight: 1 }}>
              {money(data.totalNotional)}
            </div>
            <div
              style={{
                fontSize: 14,
                color: CARD.mist,
                letterSpacing: "0.12em",
                marginTop: 6,
              }}
            >
              WITHIN 35% OF SPOT
            </div>
          </div>
        </div>

        {/* Profile */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginTop: 12,
            backgroundColor: CARD.paper,
            border: `1px solid ${CARD.rule}`,
            // 28 rows at 10px plus padding must stay inside the ~300px the card
            // has left, or the lowest price levels clip off the bottom edge.
            padding: "8px 20px",
          }}
        >
          {rows.map((bucket, i) => {
            const total = bucket.longNotional + bucket.shortNotional;
            const shortWidth = (bucket.shortNotional / max) * 100;
            const longWidth = (bucket.longNotional / max) * 100;
            const isMark = i === markIndex;
            return (
              <div
                key={bucket.price}
                style={{ display: "flex", alignItems: "center", height: 12 }}
              >
                <div
                  style={{
                    fontFamily: "Mono",
                    fontSize: 9,
                    lineHeight: 1,
                    color: isMark ? CARD.amber : CARD.mist,
                    width: 74,
                    textAlign: "right",
                  }}
                >
                  {isMark ? priceText(data.markPx) : total > 0 ? priceText(bucket.price) : ""}
                </div>
                <div style={{ display: "flex", flex: 1, height: 8, marginLeft: 10 }}>
                  {isMark ? (
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: 2,
                        backgroundColor: CARD.amber,
                        marginTop: 3,
                      }}
                    />
                  ) : (
                    <div style={{ display: "flex", width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          width: `${shortWidth}%`,
                          backgroundColor: CARD.oxblood,
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          width: `${longWidth}%`,
                          backgroundColor: CARD.teal,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "Mono",
                    fontSize: 9,
                    lineHeight: 1,
                    color: isMark ? CARD.amber : CARD.graphite,
                    width: 66,
                    textAlign: "right",
                  }}
                >
                  {isMark ? "SPOT" : total > 0 ? money(total) : ""}
                </div>
              </div>
            );
          })}
        </div>

        <div style={CARD.footer}>
          <div style={{ display: "flex" }}>
            {data.peak
              ? `Heaviest: ${money(data.peak.notional)} of ${data.peak.side === "long" ? "longs" : "shorts"} near ${priceText(data.peak.price)}`
              : "Live public Hyperliquid data"}
          </div>
          <div style={{ display: "flex", color: CARD.amber }}>hyperscope.xyz</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
