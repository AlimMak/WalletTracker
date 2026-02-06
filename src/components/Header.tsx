interface HeaderProps {
  status: "connected" | "degraded";
}

export function Header({ status }: HeaderProps) {
  const isConnected = status === "connected";

  return (
    <header className="app-panel px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Solana Dashboard</p>
          <h1 className="mt-1 text-xl font-semibold text-[color:var(--text-strong)] sm:text-2xl">
            Wallet Tracker
          </h1>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[#0d141f] px-3 py-1.5 text-xs text-slate-300">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {isConnected ? "Connected" : "Degraded"}
        </div>
      </div>
    </header>
  );
}
