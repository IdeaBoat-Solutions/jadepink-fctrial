"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote, StatusMark } from "@/components/floor/ui";
import { EndVisitButton, FCQuickAssign } from "@/components/ops";
import { timeAgo, clockTime } from "@/lib/utils";
import type { VisitLive } from "@/lib/api";
import { usePageTitle } from "@/hooks/use-page-title";

function monogram(name: string): string {
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase()) || "?";
}

export default function MyVisitsPage() {
  usePageTitle("My visits");
  const { user, visits } = useStore();
  const router = useRouter();

  if (user?.role === "manager") {
    return (
      <AccessNote
        title="Managers watch the store, not a personal queue."
        body="Open Live floor to see every active customer and who is serving them."
        action={<Btn tone="brand" onClick={() => router.push("/floor")}>Open live floor</Btn>}
      />
    );
  }

  const mine = visits.filter((v) => !v.assignedSalespersonId || v.assignedSalespersonId === user?.id);
  const open = mine.filter((v) => v.status !== "COMPLETED" && v.status !== "CANCELLED");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-semibold tracking-tight">My visits</h1>
        {open.length > 0 && (
          <p className="fp-num text-[13px] text-[var(--fp-muted)]"><span className="font-semibold text-[var(--fp-ink)]">{open.length}</span> open</p>
        )}
      </div>
      <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Everyone waiting on you — open a visit and it tells you the next step.</p>
      {open.length === 0 ? (
        <EmptyNote title="No customers are currently with you." body="A new walk-in starts from the dashboard." action={<Btn tone="line" onClick={() => router.push("/today")}>Back to dashboard</Btn>} />
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {open.map((v) => (
            <VisitCard key={v.id} v={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitCard({ v }: { v: VisitLive }) {
  const active = v.status === "ACTIVE";
  const mark = active ? "active" : v.customerId ? "selected" : "waiting";
  const label = active ? "On the floor" : v.customerId ? "Ready to start" : "Needs identification";
  const name = v.customerName || "Unidentified customer";

  /* One card, one opener + the FC picker: assigning stays on the list so a
     fresh customer can be handed to an FC without opening the visit first.
     Ending a mistaken visit stays on the card — the workspace has no end
     action, only manager-only hard delete. */
  return (
    <li className="flex flex-col rounded-2xl border border-[var(--fp-line)] bg-[var(--fp-surface)] p-5 shadow-[var(--fp-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="fp-num grid size-12 shrink-0 place-items-center rounded-full bg-[var(--fp-brand-soft)] text-[17px] font-semibold text-[var(--fp-brand-deep)]">
          {monogram(name)}
        </span>
        <StatusMark value={mark} label={label} />
      </div>
      <h2 className="fp-name mt-4 text-[26px] leading-none">{name}</h2>
      <p className="fp-num mt-2 text-[13px] text-[var(--fp-muted)]">
        {active ? `On the floor · ${timeAgo(v.startedAt || v.arrivedAt)}` : `Arrived ${clockTime(v.arrivedAt)} · ${timeAgo(v.arrivedAt)} ago`}
      </p>

      {v.customerId && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--fp-faint)]">Serving FC</p>
          <FCQuickAssign visitId={v.id} currentSpId={v.assignedSalespersonId ?? null} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/visits/${v.id}`}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--fp-brand)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--fp-brand-deep)]"
        >
          Open visit
        </Link>
        <EndVisitButton visitId={v.id} name={name} className="min-h-12" />
      </div>
    </li>
  );
}
