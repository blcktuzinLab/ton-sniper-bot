import {
  Asset,
  Factory,
  MAINNET_FACTORY_ADDR,
  Pool,
  PoolType,
  ReadinessStatus,
} from "@dedust/sdk";
import type { OpenedContract } from "@ton/core";
import { Address, toNano } from "@ton/core";
import { TonClient } from "@ton/ton";
import type { SniperConfig } from "../config.js";
import { walletToSender, type TraderWallet } from "../wallet.js";

function bpsFromSlippageString(s: string): number {
  const f = Number(s);
  if (!Number.isFinite(f) || f <= 0) return 500;
  return Math.max(1, Math.min(5000, Math.round(f * 10_000)));
}

/**
 * TON → jetton buy on DeDust volatile pool (mainnet factory).
 */
export async function buyJettonWithTonDedust(
  cfg: SniperConfig,
  client: TonClient,
  wallet: TraderWallet,
  params: {
    jettonMaster: string;
    amountNanoton: bigint;
    slippageTolerance: string;
  },
): Promise<void> {
  if (cfg.network !== "mainnet") {
    throw new Error("DeDust sniper path uses mainnet MAINNET_FACTORY_ADDR only.");
  }

  const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
  const ton = Asset.native();
  const jet = Asset.jetton(Address.parse(params.jettonMaster));

  const tryPool = async (pair: [Asset, Asset]): Promise<OpenedContract<Pool> | null> => {
    const pool = client.open(await factory.getPool(PoolType.VOLATILE, pair)) as OpenedContract<Pool>;
    const st = await pool.getReadinessStatus();
    return st === ReadinessStatus.READY ? pool : null;
  };

  const pool =
    (await tryPool([ton, jet])) ??
    (await tryPool([jet, ton]));
  if (!pool) throw new Error("DeDust: pool not ready for this jetton");

  const est = await pool.getEstimatedSwapOut({
    assetIn: ton,
    amountIn: params.amountNanoton,
  });
  if (est.amountOut <= 0n) throw new Error("DeDust: zero output for swap size");

  const bps = bpsFromSlippageString(params.slippageTolerance);
  const minOut = (est.amountOut * BigInt(10_000 - bps)) / 10_000n;

  const nativeVault = client.open(await factory.getNativeVault());
  const sender = walletToSender(wallet);

  await nativeVault.sendSwap(sender, {
    amount: params.amountNanoton,
    poolAddress: pool.address,
    limit: minOut,
    gasAmount: toNano("0.35"),
  });
}

/** True when a volatile pool exists and is deployed. */
export async function dedustPoolReady(
  client: TonClient,
  jettonMaster: string,
): Promise<boolean> {
  const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
  const ton = Asset.native();
  const jet = Asset.jetton(Address.parse(jettonMaster));

  const check = async (pair: [Asset, Asset]) => {
    const pool = client.open(await factory.getPool(PoolType.VOLATILE, pair)) as OpenedContract<Pool>;
    return (await pool.getReadinessStatus()) === ReadinessStatus.READY;
  };
  return (await check([ton, jet])) || (await check([jet, ton]));
}
