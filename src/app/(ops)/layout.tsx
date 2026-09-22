"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { FloorShell } from "@/components/floor/shell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user, loadingSession } = useStore();
  const router = useRouter();

  useEffect(() => {
    /* Only redirect once the session check has actually finished — a hard
       reload lands here with `user` still null while getMe() is in flight,
       and redirecting then would kick the FC off the visit they opened. */
    if (!loadingSession && !user) router.replace("/login");
  }, [loadingSession, user, router]);

  if (!user) {
    return (
      <div className="floor-os flex min-h-dvh items-center justify-center">
        <p className="text-[14px] text-[var(--fp-muted)]">Checking sign-in…</p>
      </div>
    );
  }

  return <FloorShell>{children}</FloorShell>;
}
