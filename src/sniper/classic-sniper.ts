import { Address } from "@ton/core";
import { StonApiClient } from "@ston-fi/api";
import { TonClient } from "@ton/ton";
import type { SniperConfig } from "../config.js";
import { buyJettonWithTonDedust, dedustPoolReady } from "../dex/dedust-buy.js";
import { buyJettonWithTonSton } from "../dex/ston-buy.js";
import { resolveTradingEndpoint } from "../rpc/benchmark.js";
import { sleep } from "../util/sleep.js";
import { openWalletV4 } from "../wallet.js";
import { stonProbeSellQuote } from "./honeypot.js";

export type ClassicSnipeDex = "ston" | "dedust";

export type ClassicSnipeParams = {
  jettonMaster: string;
  amountNanoton: bigint;
  slippageTolerance: string;
  dex: ClassicSnipeDex;
  honeypotCheck: boolean;
};

/**
 * Poll until a route/pool works, optionally verify STON reverse-quote, then send one buy.
 */
export async function runClassicSnipe(
  cfg: SniperConfig,
  params: ClassicSnipeParams,
): Promise<{ endpointUsed: string }> {
  const endpoint = await resolveTradingEndpoint(cfg);
  const client = new TonClient({ endpoint, apiKey: cfg.tonApiKey });
  const wallet = await openWalletV4(client, cfg.walletMnemonic);
  const deadline = Date.now() + cfg.maxWaitMs;

  while (Date.now() < deadline) {
    try {
      if (params.dex === "ston") {
        const api = new StonApiClient();
        const jet = Address.parse(params.jettonMaster).toString({
          bounceable: true,
          urlSafe: true,
        });
        await api.simulateSwap({
          offerAddress: cfg.stonNativeMaster,
          askAddress: jet,
          offerUnits: params.amountNanoton.toString(),
          slippageTolerance: params.slippageTolerance,
        });
        if (params.honeypotCheck) {
          const ok = await stonProbeSellQuote({
            stonNativeMaster: cfg.stonNativeMaster,
            jettonMaster: params.jettonMaster,
            slippageTolerance: params.slippageTolerance,
            probeTonOutNanotons: 10_000_000n,
          });
          if (!ok) {
            await sleep(cfg.pollIntervalMs);
            continue;
          }
        }
        await buyJettonWithTonSton(cfg, endpoint, wallet, {
          jettonMaster: params.jettonMaster,
          amountNanoton: params.amountNanoton,
          slippageTolerance: params.slippageTolerance,
        });
        return { endpointUsed: endpoint };
      }

      const ready = await dedustPoolReady(client, params.jettonMaster);
      if (!ready) {
        await sleep(cfg.pollIntervalMs);
        continue;
      }
      await buyJettonWithTonDedust(cfg, client, wallet, {
        jettonMaster: params.jettonMaster,
        amountNanoton: params.amountNanoton,
        slippageTolerance: params.slippageTolerance,
      });
      return { endpointUsed: endpoint };
    } catch {
      await sleep(cfg.pollIntervalMs);
    }
  }

  throw new Error(
    `Snipe timed out after ${cfg.maxWaitMs}ms (no working ${params.dex} route yet).`,
  );
}

/** Fire a single buy without waiting (throws if route missing). */
export async function snipeOnce(
  cfg: SniperConfig,
  params: ClassicSnipeParams,
): Promise<{ endpointUsed: string }> {
  const endpoint = await resolveTradingEndpoint(cfg);
  const client = new TonClient({ endpoint, apiKey: cfg.tonApiKey });
  const wallet = await openWalletV4(client, cfg.walletMnemonic);

  if (params.dex === "ston") {
    if (params.honeypotCheck) {
      const ok = await stonProbeSellQuote({
        stonNativeMaster: cfg.stonNativeMaster,
        jettonMaster: params.jettonMaster,
        slippageTolerance: params.slippageTolerance,
        probeTonOutNanotons: 10_000_000n,
      });
      if (!ok) throw new Error("Honeypot probe: reverse STON quote failed");
    }
    await buyJettonWithTonSton(cfg, endpoint, wallet, {
      jettonMaster: params.jettonMaster,
      amountNanoton: params.amountNanoton,
      slippageTolerance: params.slippageTolerance,
    });
    return { endpointUsed: endpoint };
  }

  if (!(await dedustPoolReady(client, params.jettonMaster))) {
    throw new Error("DeDust pool not ready");
  }
  await buyJettonWithTonDedust(cfg, client, wallet, {
    jettonMaster: params.jettonMaster,
    amountNanoton: params.amountNanoton,
    slippageTolerance: params.slippageTolerance,
  });
  return { endpointUsed: endpoint };
}
