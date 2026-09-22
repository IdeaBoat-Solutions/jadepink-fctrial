"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ModeToggle } from "@/components/layout/mode-toggle";

/* Settings — only what actually works. Appearance is real; store and session
   facts come from the live staff profile. No dead toggles. */

export default function SettingsPage() {
  const { user, profile } = useStore();
  return (
    <div className="staff-page mx-auto w-full max-w-2xl">
      <PageHeader kicker="System" title="Settings" sub="Who you are signed in as, and how the console looks." />

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-[14px]">Theme (light / dark)</p>
          <ModeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Session</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2.5 text-[13.5px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Signed in as</span>
            <strong className="text-foreground">{profile?.name ?? user?.name ?? "—"}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Role</span>
            <strong className="text-foreground">{user?.role === "manager" ? "Manager" : "Salesperson"}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Store</span>
            <strong className="text-foreground">{profile?.storeId ?? "—"}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className="text-[13.5px] leading-relaxed text-muted-foreground">
          Everything here is live in Supabase — customers, visits, floor trials, catalogue and orders.
        </CardContent>
      </Card>
    </div>
  );
}
