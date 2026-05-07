import axios from "axios";
import type { SniperConfig } from "../config.js";

const jsonRpcBody = {
  jsonrpc: "2.0" as const,
  id: 1,
  method: "getMasterchainInfo",
  params: {},
};

export type RpcBenchResult = { url: string; latencyMs: number; ok: boolean };

export async function benchmarkRpcEndpoints(
  urls: string[],
  apiKey?: string,
): Promise<RpcBenchResult[]> {
  const tasks = urls.map(async (url): Promise<RpcBenchResult> => {
    const start = Date.now();
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-API-Key"] = apiKey;
      const res = await axios.post(url, jsonRpcBody, {
        headers,
        timeout: 10_000,
        validateStatus: () => true,
      });
      const ok = res.status === 200 && res.data?.result;
      return { url, latencyMs: ok ? Date.now() - start : Number.POSITIVE_INFINITY, ok: !!ok };
    } catch {
      return { url, latencyMs: Number.POSITIVE_INFINITY, ok: false };
    }
  });
  return Promise.all(tasks);
}

export async function pickFastestRpc(
  urls: string[],
  apiKey?: string,
): Promise<{ url: string; latencyMs: number }> {
  const rows = await benchmarkRpcEndpoints(urls, apiKey);
  const alive = rows.filter((r) => r.ok && r.latencyMs < Number.POSITIVE_INFINITY);
  if (!alive.length) {
    throw new Error("No working JSON-RPC endpoints. Check TON_RPC_CANDIDATES and TONCENTER_API_KEY.");
  }
  alive.sort((a, b) => a.latencyMs - b.latencyMs);
  const best = alive[0]!;
  return { url: best.url, latencyMs: best.latencyMs };
}

/** Uses TON_ENDPOINT when only one candidate; otherwise races the list from config. */
export async function resolveTradingEndpoint(cfg: SniperConfig): Promise<string> {
  const set = [...new Set(cfg.rpcCandidates.filter(Boolean))];
  if (set.length <= 1) return cfg.tonEndpoint;
  const { url } = await pickFastestRpc(set, cfg.tonApiKey);
  return url;
}
