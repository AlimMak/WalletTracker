import { useMemo, useState } from "react";
import type { UiTxRow } from "../api/solanaRpc";
import { copyTextToClipboard } from "../utils/clipboard";
import { formatDateTime, formatSol, sumKnownSolChanges, truncateMiddle } from "../utils/format";

interface TxTableProps {
  rows: UiTxRow[];
  loading: boolean;
  loadedCount: number;
  totalCount: number;
  netSolChange: number;
  knownChangeCount: number;
  partialFailures: number;
  isCachedData: boolean;
}

type StatusFilter = "all" | "success" | "fail";

function statusClass(value: UiTxRow["status"]): string {
  if (value === "success") {
    return "pill success";
  }
  if (value === "fail") {
    return "pill fail";
  }
  return "pill";
}

function directionClass(value: UiTxRow["direction"]): string {
  if (value === "incoming") {
    return "pill incoming";
  }
  if (value === "outgoing") {
    return "pill outgoing";
  }
  return "pill";
}

export function TxTable({
  rows,
  loading,
  loadedCount,
  totalCount,
  netSolChange,
  knownChangeCount,
  partialFailures,
  isCachedData,
}: TxTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedSignature, setCopiedSignature] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") {
      return rows;
    }
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const filteredNetSolChange = useMemo(() => sumKnownSolChanges(filteredRows), [filteredRows]);
  const filteredKnownChangeCount = useMemo(
    () => filteredRows.filter((row) => row.solChange !== null).length,
    [filteredRows],
  );
  const displayedNetSolChange = statusFilter === "all" ? netSolChange : filteredNetSolChange;
  const displayedKnownChangeCount =
    statusFilter === "all" ? knownChangeCount : filteredKnownChangeCount;

  async function handleCopySignature(signature: string): Promise<void> {
    const copied = await copyTextToClipboard(signature);
    if (copied) {
      setCopiedSignature(signature);
      window.setTimeout(() => {
        setCopiedSignature((current) => (current === signature ? null : current));
      }, 1200);
    } else {
      setCopiedSignature(null);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div className="title-row">
          <h2>Recent Transactions</h2>
          {isCachedData && <span className="pill cached">cached</span>}
        </div>
        <div className="tx-tools">
          <label className="filter-label">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <div className="subtle">
            Net SOL change (known rows only):{" "}
            <strong>{formatSol(displayedNetSolChange, 6)} SOL</strong>
            {displayedKnownChangeCount > 0 ? ` across ${displayedKnownChangeCount} tx` : ""}
          </div>
        </div>
      </div>

      {loading && (
        <p className="subtle loading-text">
          Loading transactions... ({loadedCount}/{totalCount})
        </p>
      )}

      {partialFailures > 0 && (
        <p className="warning-text">
          {partialFailures} transaction detail request(s) failed. Remaining rows are shown.
        </p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Signature</th>
              <th>Status</th>
              <th>Direction</th>
              <th>Wallet Δ (SOL)</th>
              <th>Fee (SOL)</th>
              <th>Slot</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.signature}>
                <td>{formatDateTime(row.time)}</td>
                <td>
                  <div className="signature-cell">
                    <a href={row.explorerUrl} target="_blank" rel="noreferrer">
                      {truncateMiddle(row.signature, 10, 10)}
                    </a>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => {
                        void handleCopySignature(row.signature);
                      }}
                    >
                      {copiedSignature === row.signature ? "Copied" : "Copy"}
                    </button>
                  </div>
                </td>
                <td>
                  <span className={statusClass(row.status)}>{row.status}</span>
                </td>
                <td>
                  <span className={directionClass(row.direction)}>{row.direction}</span>
                </td>
                <td>{formatSol(row.solChange, 6)}</td>
                <td>{formatSol(row.feeSol, 6)}</td>
                <td className="mono">{row.slot ?? "unknown"}</td>
              </tr>
            ))}

            {loading && rows.length === 0 && (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="skeleton-row">
                    <td colSpan={7}>
                      <span />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!loading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="subtle">
                  {rows.length === 0
                    ? "No transactions found for this address."
                    : "No transactions match the selected status filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
