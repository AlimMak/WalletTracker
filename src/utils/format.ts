import type { UiTxRow } from "../api/solanaRpc";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function formatSol(value: number | null, fractionDigits = 6): string {
  if (value === null || Number.isNaN(value)) {
    return "unknown";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDateTime(date: Date | null): string {
  if (!date) {
    return "unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function truncateMiddle(value: string, keepStart = 8, keepEnd = 8): string {
  if (value.length <= keepStart + keepEnd + 1) {
    return value;
  }
  return `${value.slice(0, keepStart)}...${value.slice(-keepEnd)}`;
}

export function sumKnownSolChanges(rows: UiTxRow[]): number {
  return rows.reduce((sum, row) => {
    if (row.solChange === null) {
      return sum;
    }
    return sum + row.solChange;
  }, 0);
}
