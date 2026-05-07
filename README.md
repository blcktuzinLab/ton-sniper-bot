# TON Sniper Bot (TypeScript)

Local, non-custodial **classic sniper**: poll until **STON.fi** or **DeDust** can route **TON → jetton**, then submit one swap. Optional **STON reverse-quote probe** (`simulateReverseSwap`) reduces obvious one-way pools (not a full honeypot audit).

## Requirements

- Node **20+**
- Mainnet **DeDust** path uses the bundled factory address (mainnet only). **STON.fi** follows API/router wiring for the configured network endpoint.

## Install

```bash
npm install
cp .env.example .env
# set WALLET_MNEMONIC and optional TONCENTER_API_KEY
npm run validate-config
```

## CLI

```bash
# Race RPC candidates (TON_RPC_CANDIDATES + TON_ENDPOINT)
npm run rpc-bench

# Wait until route/pool exists, then buy (default STON, slippage from env)
npm run dev -- snipe --jetton EQ... --ton 1.5

# DeDust mainnet volatile pool
npm run dev -- snipe --jetton EQ... --ton 0.5 --dex dedust

# Single attempt (no polling loop)
npm run dev -- snipe-now --jetton EQ... --ton 0.1 --dex ston

# Skip reverse STON quote check
npm run dev -- snipe --jetton EQ... --ton 1 --no-honeypot-check
```

After `npm run build`:

```bash
node dist/index.js snipe --jetton EQ... --ton 1.5
```

## Environment

| Variable | Purpose |
|----------|---------|
| `WALLET_MNEMONIC` | Required — follower wallet seed |
| `TON_ENDPOINT` | Primary JSON-RPC URL |
| `TON_RPC_CANDIDATES` | Extra URLs; fastest used when multiple |
| `TONCENTER_API_KEY` | Recommended for Toncenter |
| `DEFAULT_SLIPPAGE` | Fraction, default `0.05` |
| `SNIPE_POLL_MS` | Loop sleep when route missing |
| `SNIPE_MAX_WAIT_MS` | Give up after this (classic `snipe` only) |

## Architecture

- `src/rpc/benchmark.ts` — `getMasterchainInfo` latency race
- `src/dex/ston-buy.ts` — STON simulate + TON→jetton router send
- `src/dex/dedust-buy.ts` — DeDust native vault swap
- `src/sniper/classic-sniper.ts` — wait loop + `snipeOnce`
- `src/sniper/honeypot.ts` — best-effort STON sell quote probe

## Disclaimer

Sniping is high risk. **DYOR.** Influencer CAs, illiquid pools, and malicious jettons exist. This software is provided under the **MIT License** — see `LICENSE`.
