import { formatPercent, formatSignedSol } from "../utils/format";

interface KpiRowProps {
  txFetched: number;
  successRate: number | null;
  netSolChange: number;
  knownDeltaCount: number;
}

export function KpiRow({ txFetched, successRate, netSolChange, knownDeltaCount }: KpiRowProps) {
  const deltaTone =
    netSolChange > 0
      ? "text-emerald-300"
      : netSolChange < 0
        ? "text-rose-300"
        : "text-slate-200";

  const cards = [
    {
      label: "Tx Fetched",
      value: txFetched.toString(),
      sub: "Rows currently displayed",
      tone: "text-slate-100",
    },
    {
      label: "Success Rate",
      value: formatPercent(successRate),
      sub: "success / (success + fail)",
      tone: "text-slate-100",
    },
    {
      label: "Net SOL Change",
      value: `${formatSignedSol(netSolChange, 6)} SOL`,
      sub: `Known deltas: ${knownDeltaCount}`,
      tone: deltaTone,
    },
  ] as const;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="app-panel p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${card.tone}`}>{card.value}</p>
          <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
        </article>
      ))}
    </section>
  );
}
