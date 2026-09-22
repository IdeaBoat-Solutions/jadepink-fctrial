"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { FloorShell } from "@/components/floor/shell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="floor-os flex min-h-dvh items-center justify-center">
        <p className="text-[14px] text-[var(--fp-muted)]">Checking sign-in…</p>
      </div>
    );
  }

  return <FloorShell>{children}</FloorShell>;
}
