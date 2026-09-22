"use client";

/* One pagination control language for both shells (ops top-bar + admin
   sidebar). Neutral ink styling works in either theme; 40px+ targets. */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parsePage, pageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/* ---------- URL-synced page state for client lists ----------
   ?page= is shareable and back-button safe. Pass a resetKey (e.g. the search
   query or filter signature) to jump back to page 1 when the result set
   changes. Must render under a <Suspense> boundary. */

export function usePageParam(resetKey = "") {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = parsePage(searchParams.get("page"));

  const setPage = (p: number) => {
    if (p === page) return;
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const prevKey = useRef(resetKey);
  useEffect(() => {
    if (prevKey.current !== resetKey) {
      prevKey.current = resetKey;
      if (page !== 1) setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return { page, setPage };
}

/* ---------- Controls ----------
   Dual mode, both props serializable across the server/client boundary:
   - onPage (client lists): buttons that call back with the page number.
   - hrefBase (server tables): plain Links to `${base}?page=N` (page 1 is the
     bare base path), zero client JS for paging. */

export function PaginationControls({
  page,
  totalPages,
  total,
  start,
  end,
  onPage,
  hrefBase,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPage?: (p: number) => void;
  hrefBase?: string;
}) {
  if (total === 0) return null;

  const nums = pageNumbers(page, totalPages);
  const hrefFor = (p: number) => (p <= 1 ? hrefBase! : `${hrefBase}?page=${p}`);
  const cls = (active: boolean) =>
    cn(
      "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-2.5 text-[13.5px] font-semibold transition-colors duration-150 active:scale-[0.95]",
      active
        ? "border-[#1c1917] bg-[#1c1917] text-white shadow-[0_4px_12px_-4px_rgba(28,25,23,0.5)]"
        : "border-[#d6c9bb] bg-white text-[#1c1917] hover:border-[#1c1917] hover:bg-[#faf8f6] disabled:cursor-not-allowed disabled:opacity-40"
    );

  const renderBtn = (p: number, label: React.ReactNode, opts: { active?: boolean; disabled?: boolean; ariaLabel?: string }) => {
    if (hrefBase && !opts.disabled) {
      return (
        <Link
          key={String(label) + p}
          href={hrefFor(p)}
          scroll={false}
          aria-label={opts.ariaLabel}
          aria-current={opts.active ? "page" : undefined}
          className={cls(!!opts.active)}
        >
          {label}
        </Link>
      );
    }
    return (
      <button
        key={String(label) + p}
        onClick={() => onPage?.(p)}
        disabled={opts.disabled || !onPage}
        aria-label={opts.ariaLabel}
        aria-current={opts.active ? "page" : undefined}
        className={cls(!!opts.active)}
      >
        {label}
      </button>
    );
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-[#e8dfd6] bg-white px-4 py-3">
      <p className="tnum text-[13px] text-[#78716c]" aria-live="polite">
        Showing <strong className="font-semibold text-[#1c1917]">{start}–{end}</strong> of <strong className="font-semibold text-[#1c1917]">{total}</strong>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {renderBtn(page - 1, <span aria-hidden>←</span>, { disabled: page <= 1, ariaLabel: "Previous page" })}
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} aria-hidden className="px-1 text-[#a8a29e]">
                …
              </span>
            ) : (
              renderBtn(n, n, { active: n === page, ariaLabel: `Page ${n}` })
            )
          )}
          {renderBtn(page + 1, <span aria-hidden>→</span>, { disabled: page >= totalPages, ariaLabel: "Next page" })}
        </div>
      )}
    </nav>
  );
}
