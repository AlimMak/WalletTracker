import { useState } from "react";

export interface RpcEndpointOption {
  label: string;
  value: string;
}

interface SettingsPanelProps {
  endpointOptions: RpcEndpointOption[];
  endpointChoice: string;
  customEndpoint: string;
  customEndpointError: string | null;
  txCount: 20 | 50;
  concurrency: 3 | 5;
  showFailedTxs: boolean;
  onEndpointChoiceChange: (value: string) => void;
  onCustomEndpointChange: (value: string) => void;
  onTxCountChange: (value: 20 | 50) => void;
  onConcurrencyChange: (value: 3 | 5) => void;
  onShowFailedChange: (value: boolean) => void;
}

export function SettingsPanel({
  endpointOptions,
  endpointChoice,
  customEndpoint,
  customEndpointError,
  txCount,
  concurrency,
  showFailedTxs,
  onEndpointChoiceChange,
  onCustomEndpointChange,
  onTxCountChange,
  onConcurrencyChange,
  onShowFailedChange,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="app-panel p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-[#0f1622] px-3.5 py-2.5 text-sm text-slate-300"
      >
        <span className="font-medium">Settings</span>
        <span className="text-xs text-slate-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-400">
            RPC Endpoint
            <select
              value={endpointChoice}
              onChange={(event) => onEndpointChoiceChange(event.target.value)}
              className="app-input mt-1"
            >
              {endpointOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {endpointChoice === "custom" && (
            <label className="text-xs text-slate-400">
              Custom RPC
              <input
                value={customEndpoint}
                onChange={(event) => onCustomEndpointChange(event.target.value)}
                placeholder="https://your-rpc.example"
                className="app-input mt-1"
              />
              {customEndpointError && (
                <p className="mt-1 text-[11px] text-rose-400">{customEndpointError}</p>
              )}
            </label>
          )}

          <label className="text-xs text-slate-400">
            Tx Count
            <select
              value={txCount}
              onChange={(event) => onTxCountChange(Number(event.target.value) as 20 | 50)}
              className="app-input mt-1"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Concurrency
            <select
              value={concurrency}
              onChange={(event) => onConcurrencyChange(Number(event.target.value) as 3 | 5)}
              className="app-input mt-1"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[#0f1622] px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showFailedTxs}
              onChange={(event) => onShowFailedChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-[#0d141f] text-emerald-400 focus:ring-emerald-400"
            />
            Show failed txs
          </label>
        </div>
      )}
    </section>
  );
}
