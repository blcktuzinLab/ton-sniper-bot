import { Address } from "@ton/core";
import { StonApiClient } from "@ston-fi/api";

/**
 * Best-effort: STON API reverse simulation (sell tiny notional of jetton → TON).
 * If it fails, the pool may be one-way or illiquid — not definitive honeypot proof.
 */
export async function stonProbeSellQuote(opts: {
  stonNativeMaster: string;
  jettonMaster: string;
  slippageTolerance: string;
  /** Desired TON out in nanotons for the probe (keep small). */
  probeTonOutNanotons: bigint;
}): Promise<boolean> {
  const api = new StonApiClient();
  const jetton = Address.parse(opts.jettonMaster).toString({ bounceable: true, urlSafe: true });
  try {
    await api.simulateReverseSwap({
      offerAddress: jetton,
      askAddress: opts.stonNativeMaster,
      askUnits: opts.probeTonOutNanotons.toString(),
      slippageTolerance: opts.slippageTolerance,
    });
    return true;
  } catch {
    return false;
  }
}
