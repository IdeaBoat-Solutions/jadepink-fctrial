"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Stage3TrialFlow } from "@/components/stage3";

export default function VisitTrialPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="staff-page">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="staff-kicker">Stage 3 · On the floor</p>
          <h1 className="staff-title mt-1">Floor trial</h1>
          <p className="staff-sub">
            Product selection → trial → liked / dropped, on this exact visit.
          </p>
        </div>
        <Link
          href={`/visits/${id}`}
          className="group inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-[#d6c9bb] px-4 text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px hover:border-[#1c1917] hover:bg-white active:translate-y-0"
        >
          <span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> Visit detail
        </Link>
      </div>

      <Stage3TrialFlow visitId={id} />
    </div>
  );
}
