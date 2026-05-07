import "dotenv/config";
import {
  DEFAULT_MAX_WAIT_MS,
  DEFAULT_POLL_MS,
  DEFAULT_SLIPPAGE,
  STON_NATIVE_MASTER,
} from "./constants.js";

export type Network = "mainnet" | "testnet";

export type SniperConfig = {
  network: Network;
  tonEndpoint: string;
  tonApiKey?: string;
  walletMnemonic: string;
  /** Candidate JSON-RPC URLs (fastest used for trades after optional bench). */
  rpcCandidates: string[];
  stonNativeMaster: string;
  defaultSlippageTolerance: string;
  pollIntervalMs: number;
  maxWaitMs: number;
};

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function listFromEnv(name: string, fallback: string): string[] {
  const raw = process.env[name];
  if (!raw?.trim()) {
    return fallback.split(/[,\s]+/).filter(Boolean);
  }
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): SniperConfig {
  const network = opt("TON_NETWORK", "mainnet") as Network;
  const main = network === "mainnet";
  const defaultRpc = main
    ? "https://toncenter.com/api/v2/jsonRPC"
    : "https://testnet.toncenter.com/api/v2/jsonRPC";
  const primary = opt("TON_ENDPOINT", defaultRpc);
  const extra = listFromEnv("TON_RPC_CANDIDATES", "");
  const rpcCandidates = [...new Set([primary, ...extra].filter(Boolean))];

  return {
    network,
    tonEndpoint: primary,
    tonApiKey: process.env.TONCENTER_API_KEY?.trim() || undefined,
    walletMnemonic: req("WALLET_MNEMONIC"),
    rpcCandidates: rpcCandidates.length ? rpcCandidates : [primary],
    stonNativeMaster: opt("STON_NATIVE_MASTER", STON_NATIVE_MASTER),
    defaultSlippageTolerance: opt("DEFAULT_SLIPPAGE", DEFAULT_SLIPPAGE),
    pollIntervalMs: Math.max(50, Number(opt("SNIPE_POLL_MS", String(DEFAULT_POLL_MS)))),
    maxWaitMs: Number(opt("SNIPE_MAX_WAIT_MS", String(DEFAULT_MAX_WAIT_MS))),
  };
}
