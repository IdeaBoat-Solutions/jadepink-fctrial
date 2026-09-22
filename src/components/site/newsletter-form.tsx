"use client";

/* Newsletter form — client island so the landing stays server-rendered.
   States: idle → error (invalid email, announced via role="alert" and
   described by aria-describedby) → success (announced via role="status").
   No fake latency: validation is synchronous and local. */

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

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
        className="reveal mt-6 flex items-center gap-4 rounded-2xl bg-brand/10 p-5 ring-1 ring-brand/25"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15">
          <span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />
        </span>
        <div>
          <p className="font-medium tracking-[0.01em] text-ink">You&apos;re on the list</p>
          <p className="mt-1 text-sm text-ink/65">
            Styling notes, once a fortnight — to <span className="font-medium text-ink">{status.email}</span>.
          </p>
        </div>
      </div>
    );
  }

  const showError = status.kind === "error";

  return (
    <div className="mt-6">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit} noValidate>
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
          className="min-w-0 flex-1 rounded-full bg-input px-5 py-2.5 text-sm text-ink ring-1 ring-shadow outline-none transition-[box-shadow,background-color] duration-200 placeholder:text-ink/35 hover:bg-glass-strong focus:ring-2 focus:ring-brand/60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/60"
        />
        <Button type="submit" variant="boutique" size="boutique">
          Join the list
        </Button>
      </form>
      {showError ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-brand">
          {status.message}
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-ink/65">One email a fortnight. Unsubscribe anytime.</p>
      )}
    </div>
  );
}
