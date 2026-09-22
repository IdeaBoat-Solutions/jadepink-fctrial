"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { OpsShell } from "@/components/layout/ops-shell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return <div className="flex min-h-dvh items-center justify-center text-[14px] text-[#78716c]">Checking sign-in…</div>;

  return (
    <div className="flex min-h-dvh flex-col bg-[#faf8f6]">
      <OpsShell>{children}</OpsShell>
    </div>
  );
}
