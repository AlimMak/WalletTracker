import { LAMPORTS_PER_SOL, lamportsToSol } from "../utils/format";

export interface WalletInputState {
  address: string;
  isValid: boolean;
  error: string | null;
}

export interface RpcResponse<T> {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  err: Record<string, unknown> | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
}

export type RpcAccountKey =
  | string
  | {
      pubkey: string;
      signer?: boolean;
      writable?: boolean;
      source?: string;
    };

export interface TransactionDetail {
  slot: number;
  blockTime: number | null;
  meta: {
    err?: unknown | null;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
  } | null;
  transaction: {
    message: {
      accountKeys: RpcAccountKey[];
    };
  } | null;
}

export interface UiTxRow {
  signature: string;
  time: Date | null;
  status: "success" | "fail" | "unknown";
  direction: "incoming" | "outgoing" | "unknown";
  solChange: number | null;
  feeSol: number | null;
  slot: number | null;
  explorerUrl: string;
}

export interface TokenAccountByOwnerValue {
  pubkey: string;
  account: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmount?: number | null;
            uiAmountString?: string;
          };
        };
      };
    };
  };
}

export interface UiTokenBalanceRow {
  mint: string;
  amount: string;
  decimals: number;
  accountCount: number;
}

export class RpcRequestError extends Error {
  code?: number;
  httpStatus?: number;
  isRateLimit: boolean;
  isNetwork: boolean;

  constructor(
    message: string,
    options?: {
      code?: number;
      httpStatus?: number;
      isRateLimit?: boolean;
      isNetwork?: boolean;
    },
  ) {
    super(message);
    this.name = "RpcRequestError";
    this.code = options?.code;
    this.httpStatus = options?.httpStatus;
    this.isRateLimit = Boolean(options?.isRateLimit);
    this.isNetwork = Boolean(options?.isNetwork);
  }
}

let rpcRequestId = 0;

async function rpcRequest<T>(
  endpoint: string,
  method: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<T> {
  const payload = {
    jsonrpc: "2.0" as const,
    id: ++rpcRequestId,
    method,
    params,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new RpcRequestError("Unable to reach RPC endpoint.", {
      isNetwork: true,
    });
  }

  if (response.status === 429) {
    throw new RpcRequestError("RPC endpoint rate limited the request.", {
      httpStatus: 429,
      isRateLimit: true,
    });
  }

  if (!response.ok) {
    throw new RpcRequestError(
      `RPC endpoint returned HTTP ${response.status}.`,
      {
        httpStatus: response.status,
      },
    );
  }

  let parsed: RpcResponse<T>;
  try {
    parsed = (await response.json()) as RpcResponse<T>;
  } catch {
    throw new RpcRequestError("RPC endpoint returned invalid JSON.");
  }

  if (parsed.error) {
    const maybeRateLimit =
      parsed.error.code === 429 ||
      parsed.error.code === -32005 ||
      /rate|too many/i.test(parsed.error.message);
    throw new RpcRequestError(parsed.error.message, {
      code: parsed.error.code,
      isRateLimit: maybeRateLimit,
    });
  }

  if (typeof parsed.result === "undefined") {
    throw new RpcRequestError("RPC response did not include a result.");
  }

  return parsed.result;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function getBalance(
  endpoint: string,
  walletAddress: string,
  signal?: AbortSignal,
): Promise<number> {
  const result = await rpcRequest<{ value: number }>(
    endpoint,
    "getBalance",
    [walletAddress, { commitment: "confirmed" }],
    signal,
  );
  return result.value;
}

export async function getSignaturesForAddress(
  endpoint: string,
  walletAddress: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SignatureInfo[]> {
  return rpcRequest<SignatureInfo[]>(
    endpoint,
    "getSignaturesForAddress",
    [walletAddress, { limit, commitment: "confirmed" }],
    signal,
  );
}

export async function getTransaction(
  endpoint: string,
  signature: string,
  signal?: AbortSignal,
): Promise<TransactionDetail | null> {
  try {
    return await rpcRequest<TransactionDetail | null>(
      endpoint,
      "getTransaction",
      [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      ],
      signal,
    );
  } catch (error) {
    if (
      error instanceof RpcRequestError &&
      (error.code === -32602 ||
        /unsupported|version|maxsupportedtransactionversion|jsonparsed/i.test(
          error.message,
        ))
    ) {
      return rpcRequest<TransactionDetail | null>(
        endpoint,
        "getTransaction",
        [
          signature,
          {
            encoding: "json",
            commitment: "confirmed",
          },
        ],
        signal,
      );
    }
    throw error;
  }
}

export async function getTokenAccountsByOwner(
  endpoint: string,
  walletAddress: string,
  signal?: AbortSignal,
): Promise<TokenAccountByOwnerValue[]> {
  const result = await rpcRequest<{ value: TokenAccountByOwnerValue[] }>(
    endpoint,
    "getTokenAccountsByOwner",
    [
      walletAddress,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ],
    signal,
  );
  return result.value;
}

function formatRawTokenAmount(rawAmount: bigint, decimals: number): string {
  if (decimals <= 0) {
    return rawAmount.toString();
  }

  const negative = rawAmount < 0n;
  const absolute = negative ? -rawAmount : rawAmount;
  const padded = absolute.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  const display = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${display}` : display;
}

export function inferUiTokenBalances(
  tokenAccounts: TokenAccountByOwnerValue[],
): UiTokenBalanceRow[] {
  const byMint = new Map<string, { rawAmount: bigint; decimals: number; accountCount: number }>();

  for (const tokenAccount of tokenAccounts) {
    const info = tokenAccount.account?.data?.parsed?.info;
    const mint = info?.mint;
    const tokenAmount = info?.tokenAmount;

    if (
      typeof mint !== "string" ||
      !tokenAmount ||
      typeof tokenAmount.amount !== "string" ||
      typeof tokenAmount.decimals !== "number"
    ) {
      continue;
    }

    let rawAmount: bigint;
    try {
      rawAmount = BigInt(tokenAmount.amount);
    } catch {
      continue;
    }

    const existing = byMint.get(mint);
    if (!existing) {
      byMint.set(mint, {
        rawAmount,
        decimals: tokenAmount.decimals,
        accountCount: 1,
      });
      continue;
    }

    byMint.set(mint, {
      rawAmount: existing.rawAmount + rawAmount,
      decimals: existing.decimals,
      accountCount: existing.accountCount + 1,
    });
  }

  return Array.from(byMint.entries())
    .sort((left, right) => {
      if (left[1].rawAmount === right[1].rawAmount) {
        return left[0].localeCompare(right[0]);
      }
      return left[1].rawAmount > right[1].rawAmount ? -1 : 1;
    })
    .map(([mint, value]) => ({
      mint,
      amount: formatRawTokenAmount(value.rawAmount, value.decimals),
      decimals: value.decimals,
      accountCount: value.accountCount,
    }));
}

function normalizeAccountKey(accountKey: RpcAccountKey): string {
  return typeof accountKey === "string" ? accountKey : accountKey.pubkey;
}

function inferCluster(endpoint: string): "mainnet-beta" | "devnet" | "testnet" {
  const lower = endpoint.toLowerCase();
  if (lower.includes("devnet")) {
    return "devnet";
  }
  if (lower.includes("testnet")) {
    return "testnet";
  }
  return "mainnet-beta";
}

function buildExplorerUrl(signature: string, endpoint: string): string {
  const cluster = inferCluster(endpoint);
  const url = `https://explorer.solana.com/tx/${signature}`;
  return cluster === "mainnet-beta" ? url : `${url}?cluster=${cluster}`;
}

export function inferUiTxRow(
  walletAddress: string,
  signatureInfo: SignatureInfo,
  detail: TransactionDetail | null,
  endpoint: string,
): UiTxRow {
  const meta = detail?.meta ?? null;
  const accountKeys = detail?.transaction?.message?.accountKeys ?? [];
  const preBalances = meta?.preBalances;
  const postBalances = meta?.postBalances;

  let solChange: number | null = null;
  let direction: UiTxRow["direction"] = "unknown";

  if (Array.isArray(accountKeys) && Array.isArray(preBalances) && Array.isArray(postBalances)) {
    const walletIndex = accountKeys.findIndex(
      (accountKey) => normalizeAccountKey(accountKey) === walletAddress,
    );

    if (
      walletIndex >= 0 &&
      walletIndex < preBalances.length &&
      walletIndex < postBalances.length
    ) {
      const lamportDelta = postBalances[walletIndex] - preBalances[walletIndex];
      solChange = lamportDelta / LAMPORTS_PER_SOL;
      if (solChange > 0) {
        direction = "incoming";
      } else if (solChange < 0) {
        direction = "outgoing";
      }
    }
  }

  let status: UiTxRow["status"] = "unknown";
  if (meta && Object.prototype.hasOwnProperty.call(meta, "err")) {
    if (meta.err === null) {
      status = "success";
    } else if (typeof meta.err !== "undefined") {
      status = "fail";
    }
  }

  const unixTime = detail?.blockTime ?? signatureInfo.blockTime;

  return {
    signature: signatureInfo.signature,
    time: typeof unixTime === "number" ? new Date(unixTime * 1000) : null,
    status,
    direction,
    solChange,
    feeSol: typeof meta?.fee === "number" ? lamportsToSol(meta.fee) : null,
    slot: typeof detail?.slot === "number" ? detail.slot : signatureInfo.slot ?? null,
    explorerUrl: buildExplorerUrl(signatureInfo.signature, endpoint),
  };
}
