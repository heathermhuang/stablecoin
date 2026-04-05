# stablecoin.io — Stablecoin Peg Monitor

**Live at [stablecoin.io](https://stablecoin.io)**

Real-time peg health and risk scores for 50+ stablecoins. Tracks price deviation from $1.00, market cap, mechanism type (fiat-backed, CDP, algorithmic, RWA), chain distribution, and exchange availability.

![stablecoin.io screenshot](https://stablecoin.io/og-image.svg)

---

## What it does

- **Peg health** — live price vs $1.00 with color-coded deviation bands (0–0.5%, 0.5–2%, 2%+)
- **Risk scores** — composite score factoring peg deviation, mechanism type, market cap, and volume
- **Mechanism classification** — fiat-backed, CDP, algorithmic, RWA, hybrid
- **Chain distribution** — number of chains and chain logos per stablecoin
- **Exchange availability** — which major exchanges list each stablecoin
- **Market cap and volume** — 24h data from CoinGecko, circulating supply from DeFi Llama

Also embedded as the third tab on [shitcoin.io](https://shitcoin.io).

---

## Architecture

Single-file Cloudflare Worker. No database, no backend framework.

```
index.html          — all UI, data, and logic (~1200 lines)
worker.js           — Cloudflare Worker: routing, proxy, legal pages, SEO
build.js            — inlines index.html into worker.js → worker.dist.js
wrangler.toml       — Cloudflare deploy config
```

**Proxy layer** — the worker proxies two APIs through allowlisted endpoints:

| Route | Upstream | Allowed endpoints |
|-------|----------|-------------------|
| `/llama/*` | DeFi Llama stablecoins API | `/stablecoins` |
| `/cg/*` | CoinGecko API v3 | `/coins/markets` |

Responses are cached via the Cloudflare Cache API with stale-while-revalidate.

---

## Local development

The stablecoin project shares the dev server pattern with shitcoin.io. For local development, clone the shitcoin repo and use its `server.js` (which supports the `/llama/` proxy route), or serve `index.html` directly and update the fetch URLs to point at the upstream APIs.

```bash
git clone https://github.com/heathermhuang/stablecoin.git
cd stablecoin
# Use the shitcoin server.js if available, or open index.html directly
```

---

## Deployment

Deploy to Cloudflare Workers via Wrangler. The stablecoin project does not have its own `node_modules` — use Wrangler from the shitcoin project or install globally:

```bash
npm install -g wrangler
node build.js        # inlines index.html → worker.dist.js
wrangler deploy      # deploys to Cloudflare
```

**Requirements:**
- Cloudflare account with Workers enabled
- `wrangler login`
- Domain pointed at Cloudflare

---

## Data sources

| Data | Source |
|------|--------|
| Peg price, circulating supply, chain list | [DeFi Llama Stablecoins API](https://stablecoins.llama.fi) (public, no key) |
| Market cap, volume, coin icons | [CoinGecko API v3](https://www.coingecko.com/en/api) (free tier, no key) |
| Chain logos | [DeFi Llama icons CDN](https://icons.llamao.fi) |

---

## Contributing

Contributions welcome. The most useful work is:

1. **Adding missing stablecoins** — edit the `SC_HARDCODED` array in `index.html` with the coin's DeFi Llama ID, CoinGecko ID, mechanism type, and exchange list
2. **Fixing mechanism classifications** — fiat/CDP/algo/rwa labels in the hardcoded list
3. **Improving risk scoring** — the `scCalcRisk` function in `index.html`

Open a PR with any changes. Please keep the project dependency-free.

---

## Related

- [shitcoin.io](https://shitcoin.io) — Binance and Coinbase delisting monitor ([source](https://github.com/heathermhuang/shitcoin))

---

## Disclaimer

This site does not provide financial advice. Stablecoin peg data is for informational purposes only. Stablecoins can and do lose their peg. Do not rely on this data for financial decisions.

---

## License

MIT — see [LICENSE](LICENSE).
