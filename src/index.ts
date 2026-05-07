#!/usr/bin/env node
import { toNano } from "@ton/core";
import { loadConfig } from "./config.js";
import { benchmarkRpcEndpoints } from "./rpc/benchmark.js";
import { runClassicSnipe, snipeOnce } from "./sniper/classic-sniper.js";

function usage(): void {
  console.log(`ton-sniper-bot — classic liquidity sniper (TypeScript)

Commands:
  help                      This help
  validate-config            Load .env / env (needs WALLET_MNEMONIC)
  rpc-bench                  Race TON_RPC_CANDIDATES with getMasterchainInfo
  snipe                      Wait for pool/route then TON → jetton buy
  snipe-now                  Same as snipe but no wait (single attempt)

snipe / snipe-now flags:
  --jetton <EQ...>          Jetton master (minter) address
  --ton <number>            Spend this many TON (e.g. 1.5)
  --dex ston|dedust         Venue (default ston)
  --slippage <n>            e.g. 0.05 = 5% (default from DEFAULT_SLIPPAGE / env)
  --no-honeypot-check       Skip STON reverse quote probe (ston path only)

Environment:
  WALLET_MNEMONIC, TON_ENDPOINT, TON_RPC_CANDIDATES, TONCENTER_API_KEY,
  SNIPE_POLL_MS, SNIPE_MAX_WAIT_MS, TON_NETWORK, STON_NATIVE_MASTER
`);
}

function argFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? "help";

  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    usage();
    return;
  }

  if (cmd === "validate-config") {
    loadConfig();
    console.log("OK");
    return;
  }

  if (cmd === "rpc-bench") {
    const cfg = loadConfig();
    const rows = await benchmarkRpcEndpoints(cfg.rpcCandidates, cfg.tonApiKey);
    const sorted = [...rows].sort((a, b) => a.latencyMs - b.latencyMs);
    for (const r of sorted) {
      console.log(`${r.ok ? "OK " : "BAD"} ${r.latencyMs}ms\t${r.url}`);
    }
    return;
  }

  if (cmd === "snipe" || cmd === "snipe-now") {
    const cfg = loadConfig();
    const jetton = argFlag(argv, "--jetton");
    const tonStr = argFlag(argv, "--ton");
    const dexRaw = argFlag(argv, "--dex") ?? "ston";
    if (!jetton || !tonStr) {
      usage();
      process.exitCode = 1;
      return;
    }
    const dex = dexRaw === "dedust" ? "dedust" : "ston";
    const amountNanoton = toNano(tonStr);
    const slippage = argFlag(argv, "--slippage") ?? cfg.defaultSlippageTolerance;
    const honeypotCheck = dex === "ston" && !hasFlag(argv, "--no-honeypot-check");

    if (cmd === "snipe-now") {
      const { endpointUsed } = await snipeOnce(cfg, {
        jettonMaster: jetton,
        amountNanoton,
        slippageTolerance: slippage,
        dex,
        honeypotCheck,
      });
      console.log(`Sent via ${endpointUsed}`);
      return;
    }

    const { endpointUsed } = await runClassicSnipe(cfg, {
      jettonMaster: jetton,
      amountNanoton,
      slippageTolerance: slippage,
      dex,
      honeypotCheck,
    });
    console.log(`Sniped via ${endpointUsed}`);
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
