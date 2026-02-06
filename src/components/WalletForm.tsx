interface WalletFormProps {
  walletAddress: string;
  walletError: string | null;
  loading: boolean;
  onAddressChange: (value: string) => void;
  onTrack: () => void;
  onReset: () => void;
}

export function WalletForm({
  walletAddress,
  walletError,
  loading,
  onAddressChange,
  onTrack,
  onReset,
}: WalletFormProps) {
  return (
    <section className="app-panel p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Track Wallet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a Solana wallet to fetch SOL balance and recent transaction activity.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onTrack();
        }}
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
      >
        <div>
          <input
            value={walletAddress}
            onChange={(event) => onAddressChange(event.target.value)}
            placeholder="Paste Solana wallet address"
            className="app-input font-mono"
          />
          {walletError && <p className="mt-1.5 text-xs text-rose-400">{walletError}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#032012] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Tracking..." : "Track"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-[color:var(--border)] bg-[#0f1622] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-[#141f2f]"
        >
          Reset
        </button>
      </form>
    </section>
  );
}
