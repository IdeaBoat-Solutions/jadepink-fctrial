"use client";

import React, { useId } from "react";
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
