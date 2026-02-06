import { LAMPORTS_PER_SOL, lamportsToSol } from "../utils/format";

interface RpcResponse<T> {
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
  err: unknown | null;
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

export type TxStatus = "success" | "fail" | "unknown";

export type TxDirection = "incoming" | "outgoing" | "unknown";

export interface UiTxRow {
  signature: string;
  time: Date | null;
  status: TxStatus;
  direction: TxDirection;
  solChange: number | null;
  feeSol: number | null;
  slot: number | null;
  explorerUrl: string;
  detailUnavailable: boolean;
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

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new RpcRequestError("Unable to connect to the selected RPC endpoint.", {
      isNetwork: true,
    });
  }

  if (response.status === 429) {
    throw new RpcRequestError("RPC rate limit hit.", {
      httpStatus: 429,
      isRateLimit: true,
    });
  }

  if (!response.ok) {
    throw new RpcRequestError(`RPC returned HTTP ${response.status}.`, {
      httpStatus: response.status,
    });
  }

  let json: RpcResponse<T>;

  try {
    json = (await response.json()) as RpcResponse<T>;
  } catch {
    throw new RpcRequestError("RPC returned an invalid JSON response.");
  }

  if (json.error) {
    const maybeRateLimit =
      json.error.code === 429 ||
      json.error.code === -32005 ||
      /rate|too many|throttle/i.test(json.error.message);

    throw new RpcRequestError(json.error.message, {
      code: json.error.code,
      isRateLimit: maybeRateLimit,
    });
  }

  if (typeof json.result === "undefined") {
    throw new RpcRequestError("RPC response did not include a result.");
  }

  return json.result;
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
        /unsupported|version|maxsupportedtransactionversion/i.test(error.message))
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

function normalizeAccountKey(accountKey: RpcAccountKey): string {
  return typeof accountKey === "string" ? accountKey : accountKey.pubkey;
}

export function inferTransactionRow(
  walletAddress: string,
  signatureInfo: SignatureInfo,
  detail: TransactionDetail | null,
  explorerUrl: string,
  detailUnavailable = false,
): UiTxRow {
  const meta = detail?.meta ?? null;
  const accountKeys = detail?.transaction?.message?.accountKeys;

  let solChange: number | null = null;
  let direction: TxDirection = "unknown";

  if (
    Array.isArray(accountKeys) &&
    Array.isArray(meta?.preBalances) &&
    Array.isArray(meta?.postBalances)
  ) {
    const walletIndex = accountKeys.findIndex(
      (accountKey) => normalizeAccountKey(accountKey) === walletAddress,
    );

    if (
      walletIndex >= 0 &&
      walletIndex < meta.preBalances.length &&
      walletIndex < meta.postBalances.length
    ) {
      const lamportDelta = meta.postBalances[walletIndex] - meta.preBalances[walletIndex];
      solChange = lamportDelta / LAMPORTS_PER_SOL;

      if (solChange > 0) {
        direction = "incoming";
      } else if (solChange < 0) {
        direction = "outgoing";
      }
    }
  }

  let status: TxStatus = "unknown";

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
    slot: typeof detail?.slot === "number" ? detail.slot : signatureInfo.slot,
    explorerUrl,
    detailUnavailable,
  };
}
