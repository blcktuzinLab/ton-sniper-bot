import { Address, type Cell, type StateInit } from "@ton/core";
import { StonApiClient } from "@ston-fi/api";
import { Client as StonTonClient, pTON, routerFactory } from "@ston-fi/sdk";
import type { SniperConfig } from "../config.js";
import type { TraderWallet } from "../wallet.js";

function toFriendly(addr: string): string {
  return Address.parse(addr).toString({ bounceable: true, urlSafe: true });
}

function normalizeOutbound(tx: {
  to: Address;
  value: bigint;
  body?: Cell | null;
  bounce?: boolean | null;
  init?: StateInit | null;
}) {
  if (tx.body == null) throw new Error("Empty router payload from STON.fi");
  return {
    to: tx.to,
    value: tx.value,
    body: tx.body,
    bounce: tx.bounce,
    init: tx.init ?? undefined,
  };
}

/**
 * One-shot TON → jetton swap on STON.fi (simulation + router message).
 */
export async function buyJettonWithTonSton(
  cfg: SniperConfig,
  endpoint: string,
  wallet: TraderWallet,
  params: {
    jettonMaster: string;
    amountNanoton: bigint;
    slippageTolerance: string;
  },
): Promise<void> {
  const api = new StonApiClient();
  const client = new StonTonClient({ endpoint, apiKey: cfg.tonApiKey });
  const jetton = toFriendly(params.jettonMaster);
  const native = cfg.stonNativeMaster;

  const simulation = await api.simulateSwap({
    offerAddress: native,
    askAddress: jetton,
    offerUnits: params.amountNanoton.toString(),
    slippageTolerance: params.slippageTolerance,
  });

  const router = client.open(
    routerFactory({
      address: simulation.routerAddress,
      majorVersion: simulation.router.majorVersion,
      minorVersion: simulation.router.minorVersion,
      routerType: simulation.router.routerType,
    }),
  );
  const proxyTon = new pTON.v2_1(simulation.router.ptonMasterAddress);

  const tx = await router.getSwapTonToJettonTxParams({
    userWalletAddress: wallet.address,
    proxyTon,
    askJettonAddress: simulation.askAddress,
    askJettonWalletAddress: simulation.askJettonWallet,
    offerAmount: BigInt(simulation.offerUnits),
    minAskAmount: BigInt(simulation.minAskUnits),
    forwardGasAmount: BigInt(simulation.gasParams.forwardGas),
  });

  await wallet.sendMessage(normalizeOutbound(tx));
}
