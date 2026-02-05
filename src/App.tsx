import { useEffect, useMemo, useRef, useState } from "react";
import {
  type SignatureInfo,
  type UiTokenBalanceRow,
  type UiTxRow,
  type WalletInputState,
  RpcRequestError,
  getBalance,
  getSignaturesForAddress,
  getTokenAccountsByOwner,
  getTransaction,
  inferUiTokenBalances,
  inferUiTxRow,
  isAbortError,
} from "./api/solanaRpc";
import { BalanceCard } from "./components/BalanceCard";
import { TokenBalances } from "./components/TokenBalances";
import { type RpcEndpointOption, WalletForm } from "./components/WalletForm";
import { TxTable } from "./components/TxTable";
import { lamportsToSol, sumKnownSolChanges } from "./utils/format";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY_PREFIX = "sol-wallet-tracker-cache:v1";

const RPC_ENDPOINT_OPTIONS: RpcEndpointOption[] = [
  {
    label: "Mainnet (api.mainnet-beta.solana.com)",
    value: "https://api.mainnet-beta.solana.com",
  },
  {
    label: "Mainnet (solana-rpc.publicnode.com)",
    value: "https://solana-rpc.publicnode.com",
  },
  {
    label: "Mainnet (rpc.ankr.com/solana)",
    value: "https://rpc.ankr.com/solana",
  },
  {
    label: "Custom",
    value: "custom",
  },
];

interface LoadProgress {
  loaded: number;
  total: number;
}

interface ActiveRequest {
  id: number;
  controller: AbortController;
}

interface CachedTxRow {
  signature: string;
  time: string | null;
  status: UiTxRow["status"];
  direction: UiTxRow["direction"];
  solChange: number | null;
  feeSol: number | null;
  slot: number | null;
  explorerUrl: string;
}

interface CachedTokenBalanceRow {
  mint: string;
  amount: string;
  decimals: number;
  accountCount: number;
}

interface StoredCachedWalletData {
  cachedAt: number;
  balanceSol: number | null;
  rows: CachedTxRow[];
  tokenBalances: CachedTokenBalanceRow[];
}

interface WalletCacheData {
  cachedAt: number;
  balanceSol: number | null;
  rows: UiTxRow[];
  tokenBalances: UiTokenBalanceRow[];
}

function validateWalletAddress(address: string): string | null {
  if (!address) {
    return "Wallet address is required.";
  }
  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return "Enter a valid Solana address (base58, 32-44 chars).";
  }
  return null;
}

function validateRpcEndpoint(endpoint: string): string | null {
  if (!endpoint) {
    return "RPC endpoint is required.";
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "RPC endpoint must start with http:// or https://.";
    }
  } catch {
    return "Enter a valid RPC endpoint URL.";
  }
  return null;
}

function getReadableError(error: unknown): string {
  if (error instanceof RpcRequestError) {
    if (error.isRateLimit) {
      return "Rate-limited by the RPC endpoint. Try lower concurrency, fewer transactions, or a different RPC.";
    }
    if (error.isNetwork) {
      return "RPC endpoint is unavailable or blocked. Check the endpoint URL and your network.";
    }
    return `RPC error: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error while loading wallet data.";
}

function getCacheKey(walletAddress: string, endpoint: string, txLimit: number): string {
  return `${CACHE_KEY_PREFIX}:${walletAddress}:${endpoint}:${txLimit}`;
}

function serializeTxRows(rows: UiTxRow[]): CachedTxRow[] {
  return rows.map((row) => ({
    signature: row.signature,
    time: row.time ? row.time.toISOString() : null,
    status: row.status,
    direction: row.direction,
    solChange: row.solChange,
    feeSol: row.feeSol,
    slot: row.slot,
    explorerUrl: row.explorerUrl,
  }));
}

function serializeTokenBalances(rows: UiTokenBalanceRow[]): CachedTokenBalanceRow[] {
  return rows.map((row) => ({
    mint: row.mint,
    amount: row.amount,
    decimals: row.decimals,
    accountCount: row.accountCount,
  }));
}

function parseFiniteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseIntegerOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function deserializeTxRows(value: unknown): UiTxRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): UiTxRow | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<CachedTxRow>;
      if (
        typeof row.signature !== "string" ||
        typeof row.status !== "string" ||
        typeof row.direction !== "string" ||
        typeof row.explorerUrl !== "string"
      ) {
        return null;
      }

      const time =
        typeof row.time === "string" && Number.isFinite(Date.parse(row.time))
          ? new Date(row.time)
          : null;
      const status: UiTxRow["status"] =
        row.status === "success" || row.status === "fail" || row.status === "unknown"
          ? row.status
          : "unknown";
      const direction: UiTxRow["direction"] =
        row.direction === "incoming" ||
        row.direction === "outgoing" ||
        row.direction === "unknown"
          ? row.direction
          : "unknown";

      return {
        signature: row.signature,
        time,
        status,
        direction,
        solChange: parseFiniteOrNull(row.solChange),
        feeSol: parseFiniteOrNull(row.feeSol),
        slot: parseFiniteOrNull(row.slot),
        explorerUrl: row.explorerUrl,
      };
    })
    .filter((row): row is UiTxRow => row !== null);
}

function deserializeTokenBalances(value: unknown): UiTokenBalanceRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): UiTokenBalanceRow | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<CachedTokenBalanceRow>;
      const decimals = parseIntegerOrNull(row.decimals);
      const accountCount = parseIntegerOrNull(row.accountCount);

      if (
        typeof row.mint !== "string" ||
        typeof row.amount !== "string" ||
        decimals === null ||
        decimals < 0 ||
        accountCount === null ||
        accountCount < 0
      ) {
        return null;
      }

      return {
        mint: row.mint,
        amount: row.amount,
        decimals,
        accountCount,
      };
    })
    .filter((row): row is UiTokenBalanceRow => row !== null);
}

function readWalletCache(
  walletAddress: string,
  endpoint: string,
  txLimit: number,
): WalletCacheData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = getCacheKey(walletAddress, endpoint, txLimit);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCachedWalletData>;
    if (typeof parsed.cachedAt !== "number" || Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      balanceSol: parseFiniteOrNull(parsed.balanceSol),
      rows: deserializeTxRows(parsed.rows),
      tokenBalances: deserializeTokenBalances(parsed.tokenBalances),
    };
  } catch {
    return null;
  }
}

function writeWalletCache(
  walletAddress: string,
  endpoint: string,
  txLimit: number,
  balanceSol: number | null,
  rows: UiTxRow[],
  tokenBalances: UiTokenBalanceRow[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  const key = getCacheKey(walletAddress, endpoint, txLimit);
  const payload: StoredCachedWalletData = {
    cachedAt: Date.now(),
    balanceSol,
    rows: serializeTxRows(rows),
    tokenBalances: serializeTokenBalances(tokenBalances),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write errors (quota, privacy mode, etc.)
  }
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (signal.aborted) {
        return;
      }
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) {
        return;
      }
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletInputState>({
    address: "",
    isValid: false,
    error: null,
  });
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(
    "https://api.mainnet-beta.solana.com",
  );
  const [customEndpoint, setCustomEndpoint] = useState<string>("");
  const [txLimit, setTxLimit] = useState<number>(20);
  const [concurrency, setConcurrency] = useState<number>(3);

  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<UiTokenBalanceRow[]>([]);
  const [rows, setRows] = useState<UiTxRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<LoadProgress>({ loaded: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [partialFailures, setPartialFailures] = useState<number>(0);
  const [isCachedData, setIsCachedData] = useState<boolean>(false);

  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const requestCounterRef = useRef<number>(0);

  const effectiveEndpoint =
    selectedEndpoint === "custom" ? customEndpoint.trim() : selectedEndpoint;

  const netSolChange = useMemo(() => sumKnownSolChanges(rows), [rows]);
  const knownChangeCount = useMemo(
    () => rows.filter((row) => row.solChange !== null).length,
    [rows],
  );

  function isCurrentRequest(requestId: number): boolean {
    return activeRequestRef.current?.id === requestId;
  }

  function cancelActiveRequest(): void {
    if (activeRequestRef.current) {
      activeRequestRef.current.controller.abort();
      activeRequestRef.current = null;
    }
  }

  function resetResults(clearAddress: boolean): void {
    cancelActiveRequest();
    setLoading(false);
    setBalanceSol(null);
    setTokenBalances([]);
    setRows([]);
    setProgress({ loaded: 0, total: 0 });
    setPartialFailures(0);
    setErrorMessage(null);
    setTokenError(null);
    setIsCachedData(false);
    if (clearAddress) {
      setWalletState({
        address: "",
        isValid: false,
        error: null,
      });
    }
  }

  async function fetchWalletData(
    walletAddress: string,
    options?: { preserveExistingData?: boolean; cachedTokenBalances?: UiTokenBalanceRow[] },
  ): Promise<void> {
    const preserveExistingData = Boolean(options?.preserveExistingData);
    const cachedTokenBalances = options?.cachedTokenBalances ?? [];
    const newRequest: ActiveRequest = {
      id: ++requestCounterRef.current,
      controller: new AbortController(),
    };
    activeRequestRef.current = newRequest;

    setLoading(true);
    setErrorMessage(null);
    setTokenError(null);
    setPartialFailures(0);
    if (!preserveExistingData) {
      setRows([]);
      setProgress({ loaded: 0, total: 0 });
      setBalanceSol(null);
      setTokenBalances([]);
      setIsCachedData(false);
    }

    try {
      const balanceLamports = await getBalance(
        effectiveEndpoint,
        walletAddress,
        newRequest.controller.signal,
      );
      const fetchedBalanceSol = lamportsToSol(balanceLamports);
      if (!isCurrentRequest(newRequest.id)) {
        return;
      }
      setBalanceSol(fetchedBalanceSol);

      let fetchedTokenBalances = cachedTokenBalances;
      try {
        const tokenAccounts = await getTokenAccountsByOwner(
          effectiveEndpoint,
          walletAddress,
          newRequest.controller.signal,
        );
        if (!isCurrentRequest(newRequest.id)) {
          return;
        }
        fetchedTokenBalances = inferUiTokenBalances(tokenAccounts);
        setTokenBalances(fetchedTokenBalances);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        if (!isCurrentRequest(newRequest.id)) {
          return;
        }
        setTokenError(getReadableError(error));
        if (!preserveExistingData) {
          fetchedTokenBalances = [];
          setTokenBalances([]);
        }
      }

      const signatures = await getSignaturesForAddress(
        effectiveEndpoint,
        walletAddress,
        txLimit,
        newRequest.controller.signal,
      );
      if (!isCurrentRequest(newRequest.id)) {
        return;
      }

      setProgress({ loaded: 0, total: signatures.length });
      if (signatures.length === 0) {
        setRows([]);
        writeWalletCache(
          walletAddress,
          effectiveEndpoint,
          txLimit,
          fetchedBalanceSol,
          [],
          fetchedTokenBalances,
        );
        setIsCachedData(false);
        return;
      }

      const nextRows: Array<UiTxRow | null> = new Array(signatures.length).fill(null);
      let loaded = 0;
      let failedCount = 0;
      let finalRows: UiTxRow[] = [];

      await processWithConcurrency<SignatureInfo>(
        signatures,
        concurrency,
        async (signatureInfo, index) => {
          let nextRow: UiTxRow;
          try {
            const detail = await getTransaction(
              effectiveEndpoint,
              signatureInfo.signature,
              newRequest.controller.signal,
            );
            nextRow = inferUiTxRow(walletAddress, signatureInfo, detail, effectiveEndpoint);
          } catch (error) {
            if (isAbortError(error)) {
              throw error;
            }
            failedCount += 1;
            nextRow = inferUiTxRow(walletAddress, signatureInfo, null, effectiveEndpoint);
          }

          if (!isCurrentRequest(newRequest.id)) {
            return;
          }

          nextRows[index] = nextRow;
          loaded += 1;
          finalRows = nextRows.filter((row): row is UiTxRow => row !== null);
          setProgress({ loaded, total: signatures.length });
          setPartialFailures(failedCount);
          setRows(finalRows);
        },
        newRequest.controller.signal,
      );

      if (isCurrentRequest(newRequest.id)) {
        writeWalletCache(
          walletAddress,
          effectiveEndpoint,
          txLimit,
          fetchedBalanceSol,
          finalRows,
          fetchedTokenBalances,
        );
        setIsCachedData(false);
      }
    } catch (error) {
      if (!isCurrentRequest(newRequest.id)) {
        return;
      }
      if (!isAbortError(error)) {
        setErrorMessage(getReadableError(error));
      }
    } finally {
      if (isCurrentRequest(newRequest.id)) {
        setLoading(false);
        activeRequestRef.current = null;
      }
    }
  }

  function handleAddressChange(value: string): void {
    const trimmed = value.trim();
    const error = trimmed.length === 0 ? null : validateWalletAddress(trimmed);
    setWalletState({
      address: value,
      isValid: !error && trimmed.length > 0,
      error,
    });
  }

  async function handleTrackWallet(): Promise<void> {
    const walletAddress = walletState.address.trim();
    const walletError = validateWalletAddress(walletAddress);
    const endpointError = validateRpcEndpoint(effectiveEndpoint);

    if (walletError || endpointError) {
      setWalletState({
        address: walletState.address,
        isValid: false,
        error: walletError,
      });
      setErrorMessage(endpointError);
      return;
    }

    const cached = readWalletCache(walletAddress, effectiveEndpoint, txLimit);
    cancelActiveRequest();

    if (cached) {
      setBalanceSol(cached.balanceSol);
      setTokenBalances(cached.tokenBalances);
      setRows(cached.rows);
      setProgress({ loaded: cached.rows.length, total: cached.rows.length });
      setPartialFailures(0);
      setErrorMessage(null);
      setTokenError(null);
      setIsCachedData(true);
    }

    await fetchWalletData(walletAddress, {
      preserveExistingData: Boolean(cached),
      cachedTokenBalances: cached?.tokenBalances ?? [],
    });
  }

  function handleCancel(): void {
    cancelActiveRequest();
    setLoading(false);
  }

  function handleReset(): void {
    resetResults(true);
  }

  useEffect(() => {
    return () => {
      cancelActiveRequest();
    };
  }, []);

  return (
    <div className="app-shell">
      <WalletForm
        walletState={walletState}
        onAddressChange={handleAddressChange}
        onSubmit={() => {
          void handleTrackWallet();
        }}
        onCancel={handleCancel}
        onReset={handleReset}
        loading={loading}
        endpointOptions={RPC_ENDPOINT_OPTIONS}
        endpointValue={selectedEndpoint}
        onEndpointChange={setSelectedEndpoint}
        customEndpoint={customEndpoint}
        onCustomEndpointChange={setCustomEndpoint}
        txLimit={txLimit}
        onTxLimitChange={setTxLimit}
        concurrency={concurrency}
        onConcurrencyChange={setConcurrency}
      />

      {errorMessage && (
        <section className="panel error-panel">
          <p className="error-text">{errorMessage}</p>
        </section>
      )}

      <BalanceCard
        walletAddress={walletState.address.trim()}
        balanceSol={balanceSol}
        loading={loading}
        isCachedData={isCachedData}
      />

      <TokenBalances
        rows={tokenBalances}
        loading={loading}
        errorMessage={tokenError}
        isCachedData={isCachedData}
      />

      <TxTable
        rows={rows}
        loading={loading}
        loadedCount={progress.loaded}
        totalCount={progress.total}
        netSolChange={netSolChange}
        knownChangeCount={knownChangeCount}
        partialFailures={partialFailures}
        isCachedData={isCachedData}
      />
    </div>
  );
}
