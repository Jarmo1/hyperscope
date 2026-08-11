import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Shared pieces for the 1200×630 share cards. Satori has no access to CSS
 * variables, so the palette is mirrored here from globals.css.
 */

export const CARD = {
  oyster: "#EDE9E2",
  paper: "#F7F5F1",
  ink: "#14181F",
  graphite: "#5C6472",
  mist: "#8B93A1",
  rule: "#D3CEC4",
  amber: "#C8720E",
  amberSoft: "#F0D9B5",
  teal: "#0F6B5C",
  tealSoft: "#CFE3DE",
  oxblood: "#9B2226",
  oxbloodSoft: "#F0D4D2",

  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#EDE9E2",
    padding: 48,
    fontFamily: "Sans",
  },
  masthead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottom: "1px solid #D3CEC4",
    paddingBottom: 16,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #D3CEC4",
    paddingTop: 14,
    marginTop: 14,
    fontSize: 16,
    color: "#5C6472",
  },
  fallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDE9E2",
    fontFamily: "Sans",
  },
} as const;

/**
 * Fonts are read from disk rather than fetched: `import.meta.url` is a file://
 * URL under the Node runtime and undici rejects those.
 *
 * `.href` is deliberate — Next re-imports these modules to build page metadata,
 * and in that bundle `URL` belongs to a different realm, so passing the object
 * makes `fileURLToPath` throw. Loading is lazy for the same reason: a throw at
 * module scope silently strips every og: tag from the page.
 */
const loadFont = (name: string) =>
  readFile(fileURLToPath(new URL(`../app/_fonts/${name}`, import.meta.url).href));

export interface CardFont {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 700;
  style: "normal";
}

let fontsPromise: Promise<CardFont[]> | null = null;

export function loadCardFonts(): Promise<CardFont[]> {
  fontsPromise ??= Promise.all([
    loadFont("cond.woff"),
    loadFont("mono.woff"),
    loadFont("sans.woff"),
  ]).then(([cond, mono, sans]): CardFont[] => [
    { name: "Cond", data: cond, weight: 700, style: "normal" },
    { name: "Mono", data: mono, weight: 500, style: "normal" },
    { name: "Sans", data: sans, weight: 400, style: "normal" },
  ]);
  return fontsPromise;
}

export function money(value: number, sign = false): string {
  const abs = Math.abs(value);
  const prefix = sign && value > 0 ? "+" : value < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${prefix}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}k`;
  return `${prefix}$${abs.toFixed(0)}`;
}

export function priceText(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

export const percentText = (value: number) => `${(Math.abs(value) * 100).toFixed(1)}%`;
