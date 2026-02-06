import { useEffect, useMemo, useRef, useState } from "react";
import { runWithConcurrency } from "./api/concurrency";
import {
  type SignatureInfo,
  type UiTxRow,
  RpcRequestError,
  getBalance,
  getSignaturesForAddress,
  getTransaction,
  inferTransactionRow,
  isAbortError,
} from "./api/solanaRpc";
import { BalanceCard } from "./components/BalanceCard";
import { Header } from "./components/Header";
import { KpiRow } from "./components/KpiRow";
import { type RpcEndpointOption, SettingsPanel } from "./components/SettingsPanel";
import { Toast } from "./components/Toast";
import { TxTable } from "./components/TxTable";
import { WalletForm } from "./components/WalletForm";
import { lamportsToSol, sumKnownSolChanges } from "./utils/format";
import { validateEndpointUrl, validateWalletAddress } from "./utils/validators";

const SOLSCAN_BASE_URL = "https://solscan.io";
const SETTINGS_STORAGE_KEY = "sol-wallet-tracker:settings:v1";

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

type TxCountOption = 20 | 50;
type ConcurrencyOption = 3 | 5;

interface TrackerSettings {
  endpointChoice: string;
  customEndpoint: string;
  txCount: TxCountOption;
  concurrency: ConcurrencyOption;
  showFailedTxs: boolean;
}

interface LoadProgress {
  loaded: number;
  total: number;
}

const DEFAULT_SETTINGS: TrackerSettings = {
  endpointChoice: RPC_ENDPOINT_OPTIONS[0].value,
  customEndpoint: "",
  txCount: 20,
  concurrency: 3,
  showFailedTxs: true,
};

const ENDPOINT_VALUE_SET = new Set(RPC_ENDPOINT_OPTIONS.map((option) => option.value));

function parseTxCount(value: unknown): TxCountOption {
  return value === 50 ? 50 : 20;
}

function parseConcurrency(value: unknown): ConcurrencyOption {
  return value === 5 ? 5 : 3;
}

function readPersistedSettings(): TrackerSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TrackerSettings>;

    return {
      endpointChoice:
        typeof parsed.endpointChoice === "string" && ENDPOINT_VALUE_SET.has(parsed.endpointChoice)
          ? parsed.endpointChoice
          : DEFAULT_SETTINGS.endpointChoice,
      customEndpoint:
        typeof parsed.customEndpoint === "string"
          ? parsed.customEndpoint
          : DEFAULT_SETTINGS.customEndpoint,
      txCount: parseTxCount(parsed.txCount),
      concurrency: parseConcurrency(parsed.concurrency),
      showFailedTxs:
        typeof parsed.showFailedTxs === "boolean"
          ? parsed.showFailedTxs
          : DEFAULT_SETTINGS.showFailedTxs,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: TrackerSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage write errors.
  }
}

function getEffectiveEndpoint(settings: TrackerSettings): string {
  return settings.endpointChoice === "custom"
    ? settings.customEndpoint.trim()
    : settings.endpointChoice;
}

function txExplorerUrl(signature: string): string {
  return `${SOLSCAN_BASE_URL}/tx/${signature}`;
}

function walletExplorerUrl(walletAddress: string): string {
  return `${SOLSCAN_BASE_URL}/account/${walletAddress}`;
}

function makePlaceholderRow(signatureInfo: SignatureInfo): UiTxRow {
  return {
    signature: signatureInfo.signature,
    time:
      typeof signatureInfo.blockTime === "number"
        ? new Date(signatureInfo.blockTime * 1000)
        : null,
    status: "unknown",
    direction: "unknown",
    solChange: null,
    feeSol: null,
    slot: signatureInfo.slot,
    explorerUrl: txExplorerUrl(signatureInfo.signature),
    detailUnavailable: false,
  };
}

function getReadableError(error: unknown): string {
  if (error instanceof RpcRequestError) {
    if (error.isRateLimit) {
      return "Rate-limited by RPC. Try lower concurrency, fewer rows, or a different endpoint.";
    }

    if (error.isNetwork) {
      return "RPC endpoint is unavailable. Check endpoint URL and network access.";
    }

    return `RPC error: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error while loading wallet data.";
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (!value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export default function App() {
  const [settings, setSettings] = useState<TrackerSettings>(() => readPersistedSettings());

  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [customEndpointError, setCustomEndpointError] = useState<string | null>(null);

  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [rows, setRows] = useState<UiTxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<LoadProgress>({ loaded: 0, total: 0 });
  const [partialFailures, setPartialFailures] = useState(0);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastTrackedWalletRef = useRef("");
  const toastTimerRef = useRef<number | null>(null);

  const effectiveEndpoint = getEffectiveEndpoint(settings);

  const displayedRows = useMemo(
    () =>
      settings.showFailedTxs ? rows : rows.filter((row) => row.status !== "fail"),
    [rows, settings.showFailedTxs],
  );

  const knownDeltaCount = useMemo(
    () => displayedRows.filter((row) => row.solChange !== null).length,
    [displayedRows],
  );

  const netSolChange = useMemo(() => sumKnownSolChanges(displayedRows), [displayedRows]);

  const successRate = useMemo(() => {
    const terminalRows = displayedRows.filter(
      (row) => row.status === "success" || row.status === "fail",
    );

    if (terminalRows.length === 0) {
      return null;
    }

    const successCount = terminalRows.filter((row) => row.status === "success").length;
    return (successCount / terminalRows.length) * 100;
  }, [displayedRows]);

  const headerStatus: "connected" | "degraded" =
    rpcError || partialFailures > 0 ? "degraded" : "connected";

  const normalizedWallet = walletAddress.trim();

  const resolvedWalletExplorerUrl = useMemo(() => {
    if (validateWalletAddress(normalizedWallet) !== null) {
      return null;
    }

    return walletExplorerUrl(normalizedWallet);
  }, [normalizedWallet]);

  const retryWallet = lastTrackedWalletRef.current || normalizedWallet;

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(message: string): void {
    setToastMessage(message);

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 1500);
  }

  function abortActiveRequest(): void {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    requestIdRef.current += 1;
  }

  function isCurrentRequest(requestId: number): boolean {
    return requestIdRef.current === requestId;
  }

  async function handleTrack(addressOverride?: string): Promise<void> {
    const targetWallet = (addressOverride ?? walletAddress).trim();
    const nextWalletError = validateWalletAddress(targetWallet);
    const nextEndpointError = validateEndpointUrl(effectiveEndpoint);

    setWalletError(nextWalletError);
    setCustomEndpointError(settings.endpointChoice === "custom" ? nextEndpointError : null);

    if (nextWalletError || nextEndpointError) {
      setRpcError(nextEndpointError ?? null);
      return;
    }

    setWalletAddress(targetWallet);
    setRpcError(null);
    setPartialFailures(0);
    setProgress({ loaded: 0, total: 0 });
    setRows([]);
    setBalanceSol(null);
    setLoading(true);

    lastTrackedWalletRef.current = targetWallet;

    abortActiveRequest();

    const requestId = requestIdRef.current;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const balanceLamports = await getBalance(
        effectiveEndpoint,
        targetWallet,
        controller.signal,
      );

      if (!isCurrentRequest(requestId)) {
        return;
      }

      setBalanceSol(lamportsToSol(balanceLamports));

      const signatures = await getSignaturesForAddress(
        effectiveEndpoint,
        targetWallet,
        settings.txCount,
        controller.signal,
      );

      if (!isCurrentRequest(requestId)) {
        return;
      }

      setProgress({ loaded: 0, total: signatures.length });
      setRows(signatures.map((signature) => makePlaceholderRow(signature)));

      if (signatures.length === 0) {
        return;
      }

      let loaded = 0;
      let failed = 0;

      await runWithConcurrency({
        items: signatures,
        concurrency: settings.concurrency,
        signal: controller.signal,
        worker: async (signatureInfo, index) => {
          let nextRow: UiTxRow;

          try {
            const detail = await getTransaction(
              effectiveEndpoint,
              signatureInfo.signature,
              controller.signal,
            );
            const unavailable = detail === null;

            if (unavailable) {
              failed += 1;
            }

            nextRow = inferTransactionRow(
              targetWallet,
              signatureInfo,
              detail,
              txExplorerUrl(signatureInfo.signature),
              unavailable,
            );
          } catch (error) {
            if (isAbortError(error)) {
              throw error;
            }

            failed += 1;
            nextRow = inferTransactionRow(
              targetWallet,
              signatureInfo,
              null,
              txExplorerUrl(signatureInfo.signature),
              true,
            );
          }

          if (!isCurrentRequest(requestId)) {
            return;
          }

          loaded += 1;

          setRows((currentRows) => {
            const nextRows = [...currentRows];
            nextRows[index] = nextRow;
            return nextRows;
          });

          setProgress({ loaded, total: signatures.length });
          setPartialFailures(failed);
        },
      });
    } catch (error) {
      if (!isCurrentRequest(requestId)) {
        return;
      }

      if (!isAbortError(error)) {
        setRpcError(getReadableError(error));
      }
    } finally {
      if (isCurrentRequest(requestId)) {
        setLoading(false);
        activeControllerRef.current = null;
      }
    }
  }

  function handleReset(): void {
    abortActiveRequest();

    setWalletAddress("");
    setWalletError(null);
    setCustomEndpointError(null);
    setBalanceSol(null);
    setRows([]);
    setProgress({ loaded: 0, total: 0 });
    setPartialFailures(0);
    setRpcError(null);
    setLoading(false);

    lastTrackedWalletRef.current = "";
  }

  function handleWalletChange(value: string): void {
    setWalletAddress(value);

    const trimmed = value.trim();
    setWalletError(trimmed.length === 0 ? null : validateWalletAddress(trimmed));
  }

  async function handleCopyWallet(): Promise<void> {
    const value = walletAddress.trim();

    if (!value) {
      return;
    }

    const copied = await copyTextToClipboard(value);
    showToast(copied ? "Wallet copied" : "Copy failed");
  }

  async function handleCopySignature(signature: string): Promise<void> {
    const copied = await copyTextToClipboard(signature);
    showToast(copied ? "Signature copied" : "Copy failed");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Header status={headerStatus} />

        <WalletForm
          walletAddress={walletAddress}
          walletError={walletError}
          loading={loading}
          onAddressChange={handleWalletChange}
          onTrack={() => {
            void handleTrack();
          }}
          onReset={handleReset}
        />

        <SettingsPanel
          endpointOptions={RPC_ENDPOINT_OPTIONS}
          endpointChoice={settings.endpointChoice}
          customEndpoint={settings.customEndpoint}
          customEndpointError={customEndpointError}
          txCount={settings.txCount}
          concurrency={settings.concurrency}
          showFailedTxs={settings.showFailedTxs}
          onEndpointChoiceChange={(value) => {
            setSettings((current) => ({ ...current, endpointChoice: value }));
            setCustomEndpointError(null);
          }}
          onCustomEndpointChange={(value) => {
            setSettings((current) => ({ ...current, customEndpoint: value }));
            setCustomEndpointError(null);
          }}
          onTxCountChange={(value) => {
            setSettings((current) => ({ ...current, txCount: value }));
          }}
          onConcurrencyChange={(value) => {
            setSettings((current) => ({ ...current, concurrency: value }));
          }}
          onShowFailedChange={(value) => {
            setSettings((current) => ({ ...current, showFailedTxs: value }));
          }}
        />

        {rpcError && (
          <section className="app-panel border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-amber-300">Degraded RPC</p>
                <p className="mt-1 text-sm text-amber-100">{rpcError}</p>
              </div>

              <button
                type="button"
                disabled={loading || retryWallet.length === 0}
                onClick={() => {
                  void handleTrack(retryWallet);
                }}
                className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retry
              </button>
            </div>
          </section>
        )}

        <BalanceCard
          walletAddress={normalizedWallet}
          balanceSol={balanceSol}
          loading={loading}
          walletExplorerUrl={resolvedWalletExplorerUrl}
          onCopyWallet={() => {
            void handleCopyWallet();
          }}
        />

        <KpiRow
          txFetched={displayedRows.length}
          successRate={successRate}
          netSolChange={netSolChange}
          knownDeltaCount={knownDeltaCount}
        />

        <TxTable
          rows={displayedRows}
          loading={loading}
          loadedCount={progress.loaded}
          totalCount={progress.total}
          partialFailures={partialFailures}
          onCopySignature={(signature) => {
            void handleCopySignature(signature);
          }}
        />
      </div>

      <Toast message={toastMessage} />
    </main>
  );
}
