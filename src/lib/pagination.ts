/* Shared pagination math — pure, framework-free, usable in server
   components (admin tables) and client components (ops lists) alike. */

export const DEFAULT_PAGE_SIZE = 10;

/** API page size: positive int clamped to [1, max]; garbage → fallback. */
export function parsePageSize(raw: string | null | undefined, fallback = 20, max = 100): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

/** Accepts only positive ints; everything else (missing, 0, NaN) → 1. */
export function parsePage(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export interface Page<T> {
  pageItems: T[];
  /** Clamped to [1, totalPages] — live lists that shrink never strand the UI. */
  page: number;
  totalPages: number;
  total: number;
  /** 1-based "Showing {start}–{end} of {total}" bounds (0,0 when empty). */
  start: number;
  end: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const from = (p - 1) * pageSize;
  return {
    pageItems: items.slice(from, from + pageSize),
    page: p,
    totalPages,
    total,
    start: total === 0 ? 0 : from + 1,
    end: Math.min(total, from + pageSize),
  };
}

/**
 * Wraps an already-paged SQL result into the same Page<T> shape, so a table
 * backed by `paginate(array, ...)` and one backed by a server-side query render
 * through identical markup and controls.
 */
export function toPageResult<T>(items: T[], page: number, pageSize: number, total: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const from = (p - 1) * pageSize;
  return {
    pageItems: items,
    page: p,
    totalPages,
    total,
    start: total === 0 ? 0 : from + 1,
    end: Math.min(total, from + pageSize),
  };
}

/** Compact page list: 1 2 … 5 6 7 … 11 12. Gaps collapse to one "…". */
export function pageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const keep = new Set(
    [1, 2, page - 1, page, page + 1, totalPages - 1, totalPages].filter((n) => n >= 1 && n <= totalPages)
  );
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}
