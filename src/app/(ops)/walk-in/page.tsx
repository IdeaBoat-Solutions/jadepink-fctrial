"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function Redirect() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("visit");
  useEffect(() => {
    router.replace(id ? `/visits/${id}` : "/today");
  }, [id, router]);
  return <p className="text-[14px] text-[var(--fp-muted)]">Opening the visit…</p>;
}

export default function WalkInPage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[var(--fp-muted)]">Opening the visit…</p>}>
      <Redirect />
    </Suspense>
  );
}
