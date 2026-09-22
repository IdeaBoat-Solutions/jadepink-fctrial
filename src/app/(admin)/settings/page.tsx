"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { ModeToggle } from "@/components/layout/mode-toggle";

export default function SettingsPage() {
  const { user, profile, storeId, loadingSession } = useStore();
  const displayName = loadingSession ? "Loading…" : user?.name?.trim() ? user.name : "—";
  return (
    <div className="staff-page mx-auto w-full max-w-2xl">
      <PageHeader kicker="System" title="Settings" sub="Store prefs, theme, demo data." />
      <Card className="transition-shadow duration-200 hover:shadow-[0_12px_28px_-16px_rgba(28,25,23,0.3)]">
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <Label htmlFor="theme" className="text-[14px]">Theme (light / dark)</Label>
          <ModeToggle />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-1"><Label htmlFor="low" className="text-[14px]">Low-stock alerts</Label><Switch id="low" defaultChecked /></div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-1"><Label htmlFor="floor" className="text-[14px]">Live floor ticker (30s)</Label><Switch id="floor" defaultChecked /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Session</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            Signed in as <strong className="font-semibold text-foreground">{displayName}</strong> ({user?.role === "manager" ? "Manager" : "Salesperson"}).
          </p>
          {user?.email && (
            <p className="tnum text-[13px] leading-relaxed text-muted-foreground">{user.email}</p>
          )}
          {profile?.role && (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">Role {profile.role}{storeId ? ` · Store ${storeId}` : " · No store assigned"}</p>
          )}
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">Floor data is live in Supabase — there is no demo reset.</p>
        </CardContent>
      </Card>
    </div>
  );
}
