"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TrialRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/visits/${id}`); }, [id, router]);
  return <p className="text-[14px] text-[var(--fp-muted)]">Opening the visit…</p>;
}
