/**
 * Shared financial calculations — the single source of truth for how
 * income, expense, transfers and percentage changes are computed across pages.
 *
 * Internal wallet-to-wallet transfers are stored as a paired EXPENSE + INCOME
 * transaction whose note starts with TRANSFER_PREFIX. They move money between
 * wallets but are NOT real income or spending.
 */

export const TRANSFER_PREFIX = "[TRANSFER]";
export const TRANSFER_CATEGORY_NAME = "Chuyển khoản nội bộ";

type TxLike = { note?: string | null; type?: string | null; amount?: unknown };

export function isTransfer(tx: { note?: string | null }): boolean {
  return String(tx.note ?? "").startsWith(TRANSFER_PREFIX);
}

/**
 * Sum real income and expense. Transfers are excluded by default; pass
 * `excludeTransfers: false` when looking at a single wallet, where a transfer
 * really does move money in or out of that wallet.
 */
export function sumIncomeExpense(
  txs: readonly TxLike[],
  { excludeTransfers = true }: { excludeTransfers?: boolean } = {}
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (excludeTransfers && isTransfer(t)) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === "INCOME") income += amt;
    else if (t.type === "EXPENSE") expense += amt;
  }
  return { income, expense, net: income - expense };
}

/**
 * Percentage change from `prev` to `curr` as a plain number (format at render time).
 * Returns null when there is no meaningful baseline (prev is 0).
 */
export function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Unclamped percentage (e.g. 250 for an overspent budget). 0 when total <= 0. */
export function percentOf(current: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, (current / total) * 100);
}
