"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AccessNote, Btn, EmptyNote, StatusMark } from "@/components/floor/ui";
import { timeAgo } from "@/lib/utils";

export default function MyVisitsPage() {
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
      <h1 className="text-[26px] font-semibold tracking-tight">My visits</h1>
      <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Customers you are serving, or who are still unassigned.</p>
      {open.length === 0 ? (
        <EmptyNote title="No customers are currently with you." body="A new walk-in starts from the dashboard." action={<Btn tone="line" onClick={() => router.push("/today")}>Back to dashboard</Btn>} />
      ) : (
        <ul className="mt-5">
          {open.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fp-line)] py-3.5">
              <div>
                <p className="fp-name text-[22px] leading-none">{v.customerName || "Unidentified customer"}</p>
                <p className="mt-1 text-[13px] text-[var(--fp-muted)]">{timeAgo(v.arrivedAt)} ago</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusMark value={v.status === "ACTIVE" ? "active" : v.customerId ? "selected" : "waiting"} label={v.status === "ACTIVE" ? "Active visit" : v.customerId ? "Ready" : "Identify"} />
                <Link href={`/visits/${v.id}`} className="text-[14px] font-semibold text-[var(--fp-brand)]">Continue</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
