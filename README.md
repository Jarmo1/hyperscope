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
- **Share cards.** Every wallet page renders a 1200×630 PNG for X, Telegram and
  Farcaster, showing the tightest position and a gauge that fills as the
  position approaches liquidation.

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
  surfaces the leveraged accounts actually near the line.

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

## Not built yet

- **Telegram alerts on followed wallets.** Needs a bot token and somewhere to
  persist follows. The intended shape is a poller diffing positions per followed
  wallet and pinging on open/close/flip.
- **Dark mode.** The light "risk desk" treatment is deliberate — it stands out
  in a timeline of dark crypto dashboards — but traders will ask.
