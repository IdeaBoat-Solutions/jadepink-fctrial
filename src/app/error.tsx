"use client";

/* Route-level error boundary. The app shell (nav, store context) stays
   mounted; only the workspace is replaced. Human copy, one clear action —
   never a raw stack trace in front of a salesperson mid-visit. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="floor-os" role="alert">
      <div className="mx-auto flex min-h-[60vh] max-w-[46ch] flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">
          Something went wrong
        </p>
        <h1 className="mt-2 text-[22px] font-semibold text-[var(--fp-ink)]">
          This screen hit a snag.
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--fp-muted)]">
          Your work so far is safe. Try again — if it keeps happening, refresh
          the page or ask your manager to check the connection.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--fp-brand)] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--fp-brand-deep)]"
          >
            Try again
          </button>
          <a
            href="/today"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--fp-line-strong)] px-5 text-[14px] font-semibold text-[var(--fp-ink)]"
          >
            Back to dashboard
          </a>
        </div>
        {error.digest && (
          <p className="fp-num mt-6 text-[12px] text-[var(--fp-faint)]">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
