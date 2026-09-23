"use client";

/* Newsletter form — client island so the landing stays server-rendered.
   States: idle → error (invalid email, announced via role="alert" and
   described by aria-describedby) → success (announced via role="status").
   No fake latency: validation is synchronous and local. */

import { useId, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = { kind: "idle" } | { kind: "error"; message: string } | { kind: "success"; email: string };

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const errorId = useId();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus({ kind: "error", message: "Enter your email address to join the list." });
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setStatus({ kind: "error", message: "That email doesn't look right — check for typos and try again." });
      return;
    }
    setStatus({ kind: "success", email: value });
  }

  if (status.kind === "success") {
    return (
      <div
        role="status"
        className="reveal mt-6 border border-black/15 bg-white p-5"
      >
        <p className="text-[15px] font-semibold text-black">You&apos;re on the list</p>
        <p className="mt-1 text-sm text-black/60">
          Styling notes, once a fortnight — to <span className="font-medium text-black">{status.email}</span>.
        </p>
      </div>
    );
  }

  const showError = status.kind === "error";

  return (
    <div className="mt-6">
      <form className="flex flex-col gap-0 border border-black/25 bg-white focus-within:border-black sm:flex-row sm:items-center" onSubmit={onSubmit} noValidate>
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (showError) setStatus({ kind: "idle" });
          }}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className="min-h-[52px] min-w-0 flex-1 bg-transparent px-4 text-[16px] text-black outline-none placeholder:text-black/40"
        />
        <button
          type="submit"
          className="inline-flex min-h-[52px] shrink-0 items-center justify-center bg-black px-6 text-[12px] font-semibold tracking-[0.2em] text-white uppercase hover:bg-[#651E2A]"
        >
          Subscribe
        </button>
      </form>
      {showError ? (
        <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-[#651E2A]">
          {status.message}
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-black/55">One email a fortnight. Unsubscribe anytime.</p>
      )}
    </div>
  );
}
