"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AdminShell } from "@/components/layout/admin-shell";
import { Providers } from "@/components/providers";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "manager") router.replace("/today");
  }, [user, router]);

  if (!user) return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Checking sign-in…</div>;
  /* Back-office is manager-only (salespeople own the floor, not analytics).
     Same rule lives in src/lib/policy.ts — UI and server match. */
  if (user.role !== "manager") return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Checking access…</div>;

  return (
    <Providers>
      <AdminShell>{children}</AdminShell>
    </Providers>
  );
}
