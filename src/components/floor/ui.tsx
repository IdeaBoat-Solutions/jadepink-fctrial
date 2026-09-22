"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export function Btn({
  tone = "line",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brand" | "ink" | "line" | "quiet" | "ok" | "drop" }) {
  const tones = {
    brand: "bg-[var(--fp-brand)] text-white hover:bg-[var(--fp-brand-deep)]",
    ink: "bg-[var(--fp-ink)] text-white hover:bg-black",
    line: "border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] text-[var(--fp-ink)] hover:border-[var(--fp-ink)]",
    quiet: "text-[var(--fp-muted)] hover:bg-[var(--fp-ink-soft)] hover:text-[var(--fp-ink)]",
    ok: "border border-[#b7d8c6] bg-[var(--fp-ok-bg)] text-[var(--fp-ok)] hover:border-[var(--fp-ok)]",
    drop: "border border-[#e4c4be] bg-[var(--fp-drop-bg)] text-[var(--fp-drop)] hover:border-[var(--fp-drop)]",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[14.5px] font-semibold transition-[background,border-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const STATUS: Record<string, { label: string; mark: string; text: string; bg: string }> = {
  active: { label: "Active", mark: "bg-[var(--fp-ok)]", text: "text-[var(--fp-ok)]", bg: "bg-[var(--fp-ok-bg)]" },
  waiting: { label: "Waiting", mark: "bg-[var(--fp-wait)]", text: "text-[var(--fp-wait)]", bg: "bg-[var(--fp-wait-bg)]" },
  available: { label: "Available", mark: "bg-[var(--fp-ok)]", text: "text-[var(--fp-ok)]", bg: "bg-[var(--fp-ok-bg)]" },
  busy: { label: "Busy", mark: "bg-[var(--fp-busy)]", text: "text-[var(--fp-busy)]", bg: "bg-[var(--fp-busy-bg)]" },
  offline: { label: "Offline", mark: "bg-[var(--fp-faint)]", text: "text-[var(--fp-muted)]", bg: "bg-[var(--fp-ink-soft)]" },
  liked: { label: "Liked", mark: "bg-[var(--fp-ok)]", text: "text-[var(--fp-ok)]", bg: "bg-[var(--fp-ok-bg)]" },
  dropped: { label: "Dropped", mark: "bg-[var(--fp-drop)]", text: "text-[var(--fp-drop)]", bg: "bg-[var(--fp-drop-bg)]" },
  trial: { label: "Trial", mark: "bg-[var(--fp-brand)]", text: "text-[var(--fp-brand-deep)]", bg: "bg-[var(--fp-brand-soft)]" },
  completed: { label: "Completed", mark: "bg-[var(--fp-ok)]", text: "text-[var(--fp-ok)]", bg: "bg-[var(--fp-ok-bg)]" },
  selected: { label: "Selected", mark: "bg-[var(--fp-ink)]", text: "text-[var(--fp-ink)]", bg: "bg-[var(--fp-ink-soft)]" },
  ready: { label: "Trial", mark: "bg-[#3d5270]", text: "text-[#3d5270]", bg: "bg-[#eef2f6]" },
};

export function StatusMark({ value, label }: { value: string; label?: string }) {
  const s = STATUS[value] ?? STATUS.selected;
  return (
    <span className={cn("inline-flex min-h-[26px] items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold", s.bg, s.text)}>
      <span aria-hidden className={cn("size-1.5 shrink-0", s.mark)} />
      {label ?? s.label}
    </span>
  );
}

export function Metric({ value, label, warn }: { value: number | string; label: string; warn?: boolean }) {
  /* Renders as dt/dd so it is valid inside the <dl> stat strips that use it
     (a div/p inside a description list is invalid HTML and confuses AT). */
  return (
    <div className="min-w-0 px-4 py-3">
      <dd className={cn("fp-num text-[26px] font-semibold leading-none tracking-tight", warn ? "text-[var(--fp-wait)]" : "text-[var(--fp-ink)]")}>{value}</dd>
      <dt className="mt-1.5 text-[12.5px] font-medium text-[var(--fp-muted)]">{label}</dt>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  /* The hint/error text is wired to the control so screen readers announce it
     with the field, not as a stray paragraph somewhere below. */
  const uid = useId();
  const msgId = error ? `${uid}-error` : hint ? `${uid}-hint` : undefined;
  const control =
    msgId && isValidElement(children)
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-describedby": msgId,
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children;
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-[var(--fp-ink)]">
        {label}
        {required && <span className="text-[var(--fp-brand)]"> *</span>}
      </label>
      <div className="mt-1.5">{control}</div>
      {error ? (
        <p id={msgId} role="alert" className="mt-1.5 text-[13px] font-medium text-[var(--fp-drop)]">{error}</p>
      ) : hint ? (
        <p id={msgId} className="mt-1.5 text-[12.5px] text-[var(--fp-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] px-3.5 text-[15px] text-[var(--fp-ink)] placeholder:text-[var(--fp-faint)] focus:border-[var(--fp-ink)] focus:outline-none";

export function EmptyNote({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-1 py-8">
      <p className="text-[16px] font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-[var(--fp-muted)]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-start justify-between gap-3 border border-[#e4c4be] bg-[var(--fp-drop-bg)] px-4 py-3.5">
      <div>
        <p className="text-[14.5px] font-semibold text-[var(--fp-drop)]">{title}</p>
        <p className="mt-0.5 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--fp-drop)]/90">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function AccessNote({ title, body, action, headingLevel = 1 }: { title: string; body: string; action?: React.ReactNode; headingLevel?: 1 | 2 }) {
  /* h1 when the note IS the page (a whole blocked screen); h2 when it sits
     under an existing page title (a blocked visit, which still shows the
     customer header). */
  const Heading = (headingLevel === 1 ? "h1" : "h2") as "h1";
  return (
    <div className="border border-[var(--fp-line)] bg-[var(--fp-surface)] px-5 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">Access</p>
      <Heading className="mt-2 text-[22px] font-semibold tracking-tight">{title}</Heading>
      <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-[var(--fp-muted)]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Drawer({
  title,
  kicker,
  onClose,
  children,
  footer,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  /* Latest onClose without re-running the mount effect: callers pass inline
     arrows, so an [onClose] dependency re-ran this on every keystroke and
     yanked focus out of the field being typed in (bill number, drop note). */
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  /* Element that opened the drawer — captured at first render, before React
     applies any autoFocus inside the panel, so restore goes back to the
     trigger rather than a control that is about to unmount. */
  const prevFocus = useRef<HTMLElement | null | undefined>(undefined);
  if (prevFocus.current === undefined) {
    prevFocus.current = typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);
  }

  useEffect(() => {
    const node = panel.current;
    // If a control inside already owns focus (React autoFocus), leave it —
    // the drawer should open ready to type, never steal the caret.
    const active = document.activeElement as HTMLElement | null;
    if (!active || !node?.contains(active)) {
      const first = node?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? node)?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      // Focus trap: keyboard users never tab out behind the modal.
      if (e.key !== "Tab" || !node) return;
      const list = [...node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.getClientRects().length > 0);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const now = document.activeElement as HTMLElement | null;
      const inside = !!now && node.contains(now);
      if (e.shiftKey && (!inside || now === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || now === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // Background must not scroll behind an aria-modal drawer.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const back = prevFocus.current;
      if (back && document.contains(back)) back.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(30,27,23,0.36)]" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="fp-rise flex h-full w-full max-w-[420px] flex-col bg-[var(--fp-surface)] shadow-[var(--fp-shadow)] outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--fp-line)] px-5 py-4">
          <div className="min-w-0">
            {kicker && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fp-faint)]">{kicker}</p>}
            <h2 id={titleId} className="mt-0.5 text-[18px] font-semibold tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-[13px] font-semibold text-[var(--fp-muted)] hover:bg-[var(--fp-ink-soft)] hover:text-[var(--fp-ink)]" aria-label="Close">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-[var(--fp-line)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
