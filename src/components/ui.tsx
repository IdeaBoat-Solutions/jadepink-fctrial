"use client";

import React, { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/* ---------- Buttons: one system, obvious hierarchy ----------
   44–48px targets · visible press · sheen on primary · arrow nudge. */

export function PrimaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "btn-sheen group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--staff-brand)] px-5 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(180,35,77,0.3),inset_0_1px_0_rgba(255,255,255,0.16)]",
        "transition-all duration-150 hover:-translate-y-px hover:bg-[#a11e45] hover:shadow-[0_8px_20px_-8px_rgba(180,35,77,0.55)] active:translate-y-0 active:scale-[0.98] active:bg-[#7d1434] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--staff-brand)]",
        "[&_svg]:transition-transform [&_svg]:duration-150 group-hover:[&_svg]:translate-x-0.5",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#d6c9bb] bg-white px-4 text-[14px] font-semibold text-[#1c1917] shadow-[0_1px_2px_rgba(28,25,23,0.05)]",
        "transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-[#faf8f6] hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)] active:translate-y-0 active:scale-[0.98] active:bg-[#f3eeea] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--staff-brand)]",
        className
      )}
    />
  );
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-[#57534e]",
        "transition-colors duration-150 hover:bg-[#f3eeea] hover:text-[#1c1917] active:bg-[#e8dfd6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--staff-brand)]",
        className
      )}
    />
  );
}

/* ---------- Fields ---------- */

export function Field({ label, required, hint, error, children, htmlFor }: {
  label: string; required?: boolean; hint?: string; error?: string;
  children: React.ReactNode; htmlFor?: string;
}) {
  /* Hint/error text is programmatically attached to the control, so AT reads
     it with the field instead of orphaned below. */
  const uid = useId();
  const msgId = error ? `${uid}-error` : hint ? `${uid}-hint` : undefined;
  const control =
    msgId && React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-describedby": msgId,
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold tracking-wide text-[#44403c]">
        {label} {required && <span className="text-[var(--staff-brand)]" aria-hidden>*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {control}
      {error ? (
        <p id={msgId} role="alert" className="ui-fade flex items-center gap-1.5 text-[13px] font-medium text-[#b4232a]">
          <span aria-hidden className="inline-block size-1 rounded-full bg-[#b4232a]" />{error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-[13px] leading-relaxed text-[#78716c]">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = ({ className, ref, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) => {
  return (
    <input
      ref={ref}
      {...props}
      className={cn(
        "min-h-[48px] w-full rounded-xl border border-[#d6c9bb] bg-white px-4 text-[16px] text-[#1c1917] shadow-[inset_0_1px_2px_rgba(28,25,23,0.04)] placeholder:text-[#76716b]",
        "transition-all duration-150 hover:border-[#a8a29e] focus:border-[var(--staff-brand)] focus:outline-none focus:ring-4 focus:ring-[var(--staff-brand)]/15",
        props["aria-invalid"] ? "border-[#b4232a] focus:border-[#b4232a] focus:ring-[#b4232a]/15" : "",
        "disabled:cursor-not-allowed disabled:bg-[#f3eeea] disabled:opacity-70",
        className
      )}
    />
  );
}

/* ---------- Status / badges: never color-alone ---------- */

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[#e6f4ec] text-[#177245] border-[#bfe3cd]",
  ASSIGNED: "bg-[#edf1f6] text-[#44566c] border-[#cbd5e1]",
  IDENTIFYING: "bg-[#fdf1d7] text-[#9a5b00] border-[#f0d48a]",
  ARRIVED: "bg-[#fdf1d7] text-[#9a5b00] border-[#f0d48a]",
  ON_FLOOR: "bg-[#e6f4ec] text-[#177245] border-[#bfe3cd]",
  COMPLETED: "bg-[#f3eeea] text-[#57534e] border-[#e8dfd6]",
  ABANDONED: "bg-[#f3eeea] text-[#78716c] border-[#e8dfd6]",
  available: "bg-[#e6f4ec] text-[#177245] border-[#bfe3cd]",
  busy: "bg-[#fdf1d7] text-[#9a5b00] border-[#f0d48a]",
  offline: "bg-[#f3eeea] text-[#78716c] border-[#e8dfd6]",
};

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={cn(
      "inline-flex min-h-[26px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tracking-wide transition-colors duration-150",
      STATUS_STYLE[value] || "bg-[#f3eeea] text-[#57534e] border-[#e8dfd6]"
    )}>
      <Dot value={value} />
      {label || value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

function Dot({ value }: { value: string }) {
  const c = value === "ACTIVE" || value === "ON_FLOOR" || value === "available"
    ? "bg-[#177245]" : value === "offline" || value === "ABANDONED" || value === "COMPLETED"
    ? "bg-[#76716b]" : value === "busy" ? "bg-[#9a5b00]" : "bg-[#9a5b00]";
  return <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", c)} />;
}

/* ---------- Cards / sections (restrained, tactile) ---------- */

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...props}
      className={cn(
        "rounded-2xl border border-[#e8dfd6] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow duration-200",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ kicker, title, aside }: { kicker?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {kicker && <p className="staff-kicker">{kicker}</p>}
        <h2 className="staff-h2 mt-1 text-balance">{title}</h2>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/* ---------- Feedback states ---------- */

export function EmptyState({ title, body, action, icon }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#d6c9bb] bg-[#faf8f6]/70 px-6 py-10 text-center sm:py-12">
      <span aria-hidden className="empty-plate">
        {icon ?? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        )}
      </span>
      <p className="mt-1 text-[15px] font-semibold tracking-tight text-[#1c1917] text-balance">{title}</p>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-[#78716c] text-pretty">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ title, body, actionLabel, onAction }: {
  title: string; body: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div role="alert" className="ui-fade flex items-start gap-3 rounded-2xl border border-[#f0b6b9] bg-[#fdecec] px-4 py-3.5 shadow-[0_1px_2px_rgba(180,35,42,0.08)]">
      <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#b4232a] text-[13px] font-bold text-white">!</span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-tight text-[#7d1a1f]">{title}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#7d1a1f]/90">{body}</p>
        {actionLabel && (
          <div className="mt-2">
            <button onClick={onAction} className="min-h-[40px] rounded-lg bg-white px-3.5 text-[13.5px] font-semibold text-[#7d1a1f] ring-1 ring-[#f0b6b9] transition-colors hover:bg-[#fff7f7] active:bg-[#fdeaea]">
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-soft rounded-lg", className)} />;
}

/* ---------- Inline progress + confirmation ---------- */

export function InlineSaving({ label = "Saving…" }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 rounded-full bg-[#faf8f6] py-1 pl-1 pr-3 text-[13px] font-medium text-[#78716c] ring-1 ring-[#e8dfd6]">
      <span aria-hidden className="grid size-5 place-items-center">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d6c9bb] border-t-[var(--staff-brand)]" />
      </span>
      {label}
    </span>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = "Cancel", danger, onConfirm, onCancel, busy }: {
  title: string; body: string; confirmLabel: string; cancelLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  /* Dialog ergonomics: Escape cancels and the page behind can't scroll
     while a decision is pending. The safe action owns initial focus. */
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    const node = panel.current;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      // Trap: Tab never walks out behind the alertdialog.
      const list = [...node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.getClientRects().length > 0);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && node.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, []);

  return (
    <div role="alertdialog" aria-modal="true" aria-label={title} onClick={onCancel} className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-[2px] sm:items-center">
      <div ref={panel} onClick={(e) => e.stopPropagation()} className="ui-rise w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_24px_60px_-16px_rgba(28,25,23,0.5)] ring-1 ring-black/5 sm:p-6">
        <h3 className="text-[16px] font-semibold tracking-tight text-[#1c1917] text-balance">{title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#57534e] text-pretty">{body}</p>
        <div className="mt-5 flex gap-2">
          <SecondaryButton autoFocus onClick={onCancel} className="min-h-[48px] flex-1">{cancelLabel}</SecondaryButton>
          <button
            onClick={onConfirm} disabled={busy}
            className={danger
              ? "min-h-[48px] flex-1 rounded-xl bg-[#b4232a] px-4 text-[14px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(180,35,42,0.6)] transition-all duration-150 hover:-translate-y-px hover:bg-[#8f1b21] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              : "min-h-[48px] flex-1 rounded-xl bg-[#1c1917] px-4 text-[14px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-black active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
