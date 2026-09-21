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
  }, [user, router]);

  if (!user) return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Checking sign-in…</div>;

  return (
    <Providers>
      <AdminShell>{children}</AdminShell>
    </Providers>
  );
}
