import type { UiTxRow } from "../api/solanaRpc";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function formatSol(value: number | null, decimals = 6): string {
  if (value === null || Number.isNaN(value)) {
    return "unknown";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatSignedSol(value: number | null, decimals = 6): string {
  if (value === null || Number.isNaN(value)) {
    return "unknown";
  }

  const absolute = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  if (value > 0) {
    return `+${absolute}`;
  }

  if (value < 0) {
    return `-${absolute}`;
  }

  return "0";
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(decimals)}%`;
}

export function formatDateTime(date: Date | null): string {
  if (!date) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function truncateMiddle(value: string, start = 6, end = 6): string {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function sumKnownSolChanges(rows: UiTxRow[]): number {
  return rows.reduce((sum, row) => {
    if (row.solChange === null) {
      return sum;
    }

    return sum + row.solChange;
  }, 0);
}

export function sortRowsNewestFirst(rows: UiTxRow[]): UiTxRow[] {
  return [...rows].sort((left, right) => {
    const leftTime = left.time ? left.time.getTime() : 0;
    const rightTime = right.time ? right.time.getTime() : 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    const leftSlot = left.slot ?? 0;
    const rightSlot = right.slot ?? 0;
    return rightSlot - leftSlot;
  });
}

export function sortRowsBySolDelta(rows: UiTxRow[]): UiTxRow[] {
  const known = rows.filter((row) => row.solChange !== null);
  const unknown = rows.filter((row) => row.solChange === null);

  known.sort((left, right) => (right.solChange ?? 0) - (left.solChange ?? 0));

  return [...known, ...sortRowsNewestFirst(unknown)];
}
