import type { WalletInputState } from "../api/solanaRpc";

export interface RpcEndpointOption {
  label: string;
  value: string;
}

interface WalletFormProps {
  walletState: WalletInputState;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReset: () => void;
  loading: boolean;
  endpointOptions: RpcEndpointOption[];
  endpointValue: string;
  onEndpointChange: (value: string) => void;
  customEndpoint: string;
  onCustomEndpointChange: (value: string) => void;
  txLimit: number;
  onTxLimitChange: (value: number) => void;
  concurrency: number;
  onConcurrencyChange: (value: number) => void;
}

export function WalletForm({
  walletState,
  onAddressChange,
  onSubmit,
  onCancel,
  onReset,
  loading,
  endpointOptions,
  endpointValue,
  onEndpointChange,
  customEndpoint,
  onCustomEndpointChange,
  txLimit,
  onTxLimitChange,
  concurrency,
  onConcurrencyChange,
}: WalletFormProps) {
  return (
    <section className="panel">
      <h1>Solana Wallet Tracker</h1>
      <p className="subtle">
        Paste a wallet address to view current balance and recent transaction deltas.
      </p>

      <form
        className="wallet-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="walletAddress">Wallet Address</label>
        <input
          id="walletAddress"
          name="walletAddress"
          placeholder="Enter Solana address..."
          autoComplete="off"
          spellCheck={false}
          value={walletState.address}
          onChange={(event) => onAddressChange(event.target.value)}
        />
        {walletState.error && <p className="error-text">{walletState.error}</p>}

        <div className="settings-grid">
          <label>
            RPC Endpoint
            <select
              value={endpointValue}
              onChange={(event) => onEndpointChange(event.target.value)}
            >
              {endpointOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Transactions
            <select
              value={txLimit}
              onChange={(event) => onTxLimitChange(Number(event.target.value))}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <label>
            Concurrency
            <select
              value={concurrency}
              onChange={(event) => onConcurrencyChange(Number(event.target.value))}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </label>
        </div>

        {endpointValue === "custom" && (
          <label>
            Custom RPC URL
            <input
              placeholder="https://..."
              value={customEndpoint}
              onChange={(event) => onCustomEndpointChange(event.target.value)}
            />
          </label>
        )}

        <div className="button-row">
          <button type="submit" disabled={loading}>
            {loading ? "Tracking..." : "Track Wallet"}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={!loading}>
            Cancel
          </button>
          <button type="button" className="secondary" onClick={onReset}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}
