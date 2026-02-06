import { useMemo, useState } from "react";
import type { UiTxRow } from "../api/solanaRpc";
import {
  formatDateTime,
  formatSignedSol,
  formatSol,
  sortRowsBySolDelta,
  sortRowsNewestFirst,
  truncateMiddle,
} from "../utils/format";

type SortMode = "newest" | "delta";

interface TxTableProps {
  rows: UiTxRow[];
  loading: boolean;
  loadedCount: number;
  totalCount: number;
  partialFailures: number;
  onCopySignature: (signature: string) => void;
}

function statusPillClass(status: UiTxRow["status"]): string {
  if (status === "success") {
    return "border-emerald-500/30 text-emerald-300";
  }

  if (status === "fail") {
    return "border-rose-500/35 text-rose-300";
  }

  return "border-[color:var(--border)] text-slate-400";
}

function directionPillClass(direction: UiTxRow["direction"]): string {
  if (direction === "incoming") {
    return "border-emerald-500/30 text-emerald-300";
  }

  if (direction === "outgoing") {
    return "border-amber-500/35 text-amber-300";
  }

  return "border-[color:var(--border)] text-slate-400";
}

function deltaClass(value: number | null): string {
  if (value === null) {
    return "text-slate-400";
  }

  if (value > 0) {
    return "text-emerald-300";
  }

  if (value < 0) {
    return "text-rose-300";
  }

  return "text-slate-200";
}

export function TxTable({
  rows,
  loading,
  loadedCount,
  totalCount,
  partialFailures,
  onCopySignature,
}: TxTableProps) {
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const sortedRows = useMemo(
    () => (sortMode === "newest" ? sortRowsNewestFirst(rows) : sortRowsBySolDelta(rows)),
    [rows, sortMode],
  );

  const isEmpty = !loading && sortedRows.length === 0;

  return (
    <section className="app-panel p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Recent Transactions
        </h2>

        <button
          type="button"
          onClick={() => setSortMode((mode) => (mode === "newest" ? "delta" : "newest"))}
          className="rounded-lg border border-[color:var(--border)] bg-[#0f1622] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-[#141f2f]"
        >
          Sort: {sortMode === "newest" ? "Newest" : "SOL Δ"}
        </button>
      </div>

      {loading && totalCount > 0 && (
        <p className="mb-3 text-xs text-slate-500">
          Loading transaction details... ({loadedCount}/{totalCount})
        </p>
      )}

      {partialFailures > 0 && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {partialFailures} transaction detail request(s) were unavailable. Showing best-effort rows.
        </p>
      )}

      {isEmpty ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[#0f1622] p-6 text-center">
          <h3 className="text-base font-medium text-slate-200">No transactions found</h3>
          <p className="mt-2 text-sm text-slate-500">
            Try a more active wallet, increase tx count, or enable failed transactions in settings.
          </p>
        </div>
      ) : (
        <div className="max-h-[540px] overflow-auto rounded-xl border border-[color:var(--border)]">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  Time
                </th>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  Sig
                </th>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  Status
                </th>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  Direction
                </th>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-right text-xs uppercase tracking-[0.12em] text-slate-500">
                  SOL Δ
                </th>
                <th className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[#0d141f] px-3 py-2 text-right text-xs uppercase tracking-[0.12em] text-slate-500">
                  Fee
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.signature} className="transition hover:bg-[color:var(--row-hover)]">
                  <td className="border-b border-[color:var(--border)] px-3 py-2 text-slate-400">
                    {formatDateTime(row.time)}
                  </td>

                  <td className="border-b border-[color:var(--border)] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={row.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-slate-300 hover:text-emerald-300"
                        title={row.signature}
                      >
                        {truncateMiddle(row.signature, 10, 10)} ↗
                      </a>

                      <button
                        type="button"
                        onClick={() => onCopySignature(row.signature)}
                        className="rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-[#141f2f]"
                      >
                        Copy
                      </button>
                    </div>

                    {row.detailUnavailable && (
                      <p className="mt-1 text-[11px] text-amber-300">detail unavailable</p>
                    )}
                  </td>

                  <td className="border-b border-[color:var(--border)] px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusPillClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </td>

                  <td className="border-b border-[color:var(--border)] px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${directionPillClass(
                        row.direction,
                      )}`}
                    >
                      {row.direction}
                    </span>
                  </td>

                  <td className={`border-b border-[color:var(--border)] px-3 py-2 text-right font-medium ${deltaClass(row.solChange)}`}>
                    {formatSignedSol(row.solChange, 6)}
                  </td>

                  <td className="border-b border-[color:var(--border)] px-3 py-2 text-right text-slate-400">
                    {row.feeSol === null ? "--" : formatSol(row.feeSol, 6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
