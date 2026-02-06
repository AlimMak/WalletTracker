import { formatSol, truncateMiddle } from "../utils/format";

interface BalanceCardProps {
  walletAddress: string;
  balanceSol: number | null;
  loading: boolean;
  walletExplorerUrl: string | null;
  onCopyWallet: () => void;
}

export function BalanceCard({
  walletAddress,
  balanceSol,
  loading,
  walletExplorerUrl,
  onCopyWallet,
}: BalanceCardProps) {
  return (
    <section className="app-panel p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SOL Balance</p>

      <div className="mt-3 flex items-end gap-2">
        <h3 className="text-4xl font-semibold leading-none text-[color:var(--text-strong)] sm:text-5xl">
          {loading && balanceSol === null ? "--" : formatSol(balanceSol, 9)}
        </h3>
        <span className="pb-1 text-sm font-medium text-slate-400">SOL</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-[color:var(--border)] bg-[#0f1622] px-2.5 py-1 font-mono text-xs text-slate-300">
          {walletAddress ? truncateMiddle(walletAddress, 12, 12) : "No wallet selected"}
        </span>

        <button
          type="button"
          onClick={onCopyWallet}
          disabled={!walletAddress}
          className="rounded-lg border border-[color:var(--border)] bg-[#0f1622] px-2.5 py-1 text-xs text-slate-300 transition hover:bg-[#141f2f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy
        </button>

        {walletExplorerUrl && (
          <a
            href={walletExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[color:var(--border)] bg-[#0f1622] px-2.5 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-300"
          >
            Open Wallet ↗
          </a>
        )}
      </div>
    </section>
  );
}
