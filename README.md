# Hyperscope

Read any Hyperliquid wallet: live positions, how far each one is from
liquidation, and the win rate the official leaderboard doesn't show.

Zero running cost. No API keys, no RPC provider, no database, no wallet
connection. Every number comes from Hyperliquid's public endpoints.

## Why this exists

Hyperliquid publishes everything needed to judge a trader and assembles none of
it. The official leaderboard ranks on raw profit, so the same handful of
enormous accounts sit on top permanently, and it never shows win rate, profit
factor, or how close anyone is to being wiped out.

## What it does

- **`/` — the risk board.** The busiest accounts on the exchange ranked by how
  little room their tightest position has left. Typically surfaces 40× BTC
  positions sitting under 1% from liquidation.
- **`/w/<address>` — the wallet sheet.** Open positions on a true price scale
  (liquidation / entry / mark), account equity curve, and a trading record
  derived from raw fills: win rate, profit factor, average win vs loss, and
  realised PnL split by market.
- **`/board` — the leaderboard, bracketed.** Filter by account size, window and
  sort. Turnover is shown alongside return so a big percentage on a small base
  is visible rather than misleading.
- **`/heat` — the liquidation map.** Every open position across the largest
  accounts, aggregated by liquidation price into a volume profile. Shows where
  forced selling is stacked, e.g. "$213M of shorts unwind 1.2% above spot".
- **Share cards.** Every wallet and market page renders a 1200×630 PNG for X,
  Telegram and Farcaster.
- **An auto-poster.** `scripts/post.mjs` asks the site for the most postable
  fact and publishes it. Scheduled hourly by GitHub Actions.

## Data sources

All public, all keyless:

| Source | Used for |
| --- | --- |
| `POST api.hyperliquid.xyz/info` `clearinghouseState` | Open positions, margin, liquidation prices |
| `POST api.hyperliquid.xyz/info` `userFills` | Win rate, profit factor, per-market PnL (last 2,000 fills) |
| `POST api.hyperliquid.xyz/info` `portfolio` | Account value and PnL history |
| `POST api.hyperliquid.xyz/info` `allMids` | Mark prices |
| `GET stats-data.hyperliquid.xyz/Mainnet/leaderboard` | 41k+ traders with PnL, ROI and volume per window |

### Notes on the data

Things that cost real time to work out, kept here so they don't have to be
rediscovered:

- **The leaderboard is ~34–45MB.** Far past Next's 2MB-per-entry data cache, so
  it's fetched uncached and a slimmed copy (accounts ≥ $10k, ~16k traders) is
  held in module memory with a 30-minute TTL and stale-while-revalidate. Parsing
  costs ~500ms and peaks around 186MB RSS.
- **`pnl` and `roi` disagree for about 1 account in 10, and both are correct.**
  ROI is time-weighted, so an account that turned $300 into $2k and then
  deposited $260k shows a small dollar PnL against a 552% return. The board
  sorts by dollars by default and shows turnover so this is legible.
- **Turnover below 1× is filtered** on the board. An account cannot have made a
  large return trading less volume than it holds.
- **Win rate uses closing fills only.** Hyperliquid reports realised PnL on the
  fill that closes size; opening fills carry `closedPnl: 0`. Counting them drags
  every trader toward 50%.
- **Ranking candidates by account value produces a boring risk board.** Whales
  run low leverage and sit 50%+ from liquidation. Ranking by recent volume
  surfaces the leveraged accounts actually near the line. (The heatmap wants the
  opposite — notional concentrates in the big accounts.)
- **Hyperliquid throttles around 1,200 request-weight/minute per IP.** A burst
  of 400 `clearinghouseState` calls (800 weight) completes in ~6s and is fine;
  2,500 in one sweep loses ~20% to throttling. Hence the rolling scanner: one
  400-account slice per minute, accumulating into a shared snapshot.
- **Depth changes the product.** 400 accounts gives 3 chartable markets and ~11
  BTC positions; ~2,000 gives 7 markets and ~65, with 4× the notional.

### Next.js 16 traps hit building this

All three failed silently rather than erroring:

- **Module state is not shared between route bundles.** A page and its own
  `opengraph-image` each got a private cache, so the share card reported 7 BTC
  positions while the page showed 81 — and the 45MB leaderboard was fetched once
  per route. Fixed by hanging caches off a global symbol (`lib/shared-state.ts`).
- **`fetch()` on a `file://` URL fails** under the Node runtime, which breaks the
  documented `new URL(..., import.meta.url)` font-loading pattern. Use
  `readFile`.
- **In `opengraph-image.tsx`, `fileURLToPath(new URL(...))` throws cross-realm**,
  because Next re-imports the module to build meta tags where `URL` is a
  different class. Pass `.href`, and load fonts lazily — a throw at module scope
  strips every `og:` and `twitter:` tag from the page with no error on the page.

## Running it

```bash
npm install
npm run dev
```

No environment variables are required. Set `NEXT_PUBLIC_SITE_URL` in production
so share-card URLs resolve absolutely (on Vercel this is inferred).

## Deploying

Vercel free tier is sufficient — everything is server-rendered on demand with
in-memory caching, and there's no database. The risk board scan issues ~180
`clearinghouseState` calls per refresh (weight 2 each against Hyperliquid's
1,200/min IP budget) and is cached for 90 seconds.

## The posting loop

`scripts/post.mjs` runs hourly via `.github/workflows/post.yml`:

1. `GET /api/story` returns the most postable fact right now plus a stable key.
2. The script checks that key against `data/posted.json` and stops if it has
   already gone out.
3. It publishes to whichever channels are configured, then the workflow commits
   the updated key list back to the repo.

That keeps the site stateless and the whole loop free — GitHub Actions is the
scheduler because Vercel's free tier caps cron at one run per day.

Configure via repo settings:

| Where | Name | Purpose |
| --- | --- | --- |
| Variable | `SITE_URL` | Your deployed origin |
| Secret | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Free and unlimited — start here |
| Secret | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | Optional; X's free tier is heavily capped |
| Secret | `DISCORD_WEBHOOK_URL` | Optional |

Nothing posts until a channel is configured, and a story is only recorded as
published if at least one channel accepted it. Run the workflow manually with
"dry run" first — it prints the post without sending it.

## Not built yet

- **Telegram alerts on followed wallets.** Needs a bot token and somewhere to
  persist follows. The intended shape is a poller diffing positions per followed
  wallet and pinging on open/close/flip.
- **Dark mode.** The light "risk desk" treatment is deliberate — it stands out
  in a timeline of dark crypto dashboards — but traders will ask.
