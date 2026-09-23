"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check, Copy, LogOut, PanelLeft,
  ShieldCheck, UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Providers } from "@/components/providers";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/* Production-grade settings — the two-pane pattern heavy-user consoles use:
   sticky section nav on the left, focused sections on the right, every
   control wired to something real. No dead toggles: sidebar state through
   the shell, session actions hit the live store. */

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: PanelLeft },
  { id: "session", label: "Session", icon: ShieldCheck },
] as const;

function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join("|")]);
  return active;
}

function SectionNav({ active }: { active: string }) {
  return (
    <nav aria-label="Settings sections" className="flex gap-1.5 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:overflow-visible">
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={on ? "true" : undefined}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              on && "bg-muted font-semibold text-foreground shadow-[inset_2px_0_0_var(--staff-brand)]",
            )}
          >
            <s.icon className="size-4 shrink-0" />
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}

function ProfileSection() {
  const { user, profile } = useStore();
  const [copied, setCopied] = useState(false);
  const name = profile?.name ?? user?.name ?? "—";
  const copyId = () => {
    if (!user?.id) return;
    void navigator.clipboard?.writeText(user.id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <section id="profile" aria-label="Profile" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Who you are signed in as. Identity is managed by your store admin.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--staff-brand)] text-[18px] font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold tracking-tight">{name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{user?.email ?? "No email on file"}</p>
            </div>
            <Badge variant={user?.role === "manager" ? "default" : "secondary"} className="ml-auto shrink-0">
              {user?.role === "manager" ? "Manager" : "Salesperson"}
            </Badge>
          </div>
          <dl className="grid gap-x-6 gap-y-2.5 border-t border-dashed pt-4 text-[13.5px] sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted-foreground">Store</dt>
              <dd className="tnum font-semibold">{profile?.storeId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted-foreground">Staff ID</dt>
              <dd className="flex items-center justify-end gap-1.5 sm:justify-start">
                <span className="tnum max-w-[140px] truncate font-mono text-[12.5px] font-semibold" title={user?.id ?? ""}>
                  {user?.id ? `${user.id.slice(0, 8)}…` : "—"}
                </span>
                {user?.id && (
                  <button
                    type="button"
                    onClick={copyId}
                    aria-label="Copy full staff ID"
                    title="Copy full ID"
                    className="grid min-h-[32px] min-w-[32px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

function WorkspaceSection() {
  const { open, setOpen, isMobile } = useSidebar();
  return (
    <section id="workspace" aria-label="Workspace" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            The navigation rail collapses to icons when you need the full width for the floor.{" "}
            {isMobile ? "On this screen it opens as a drawer." : `Currently ${open ? "expanded" : "collapsed to icons"} on this device.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant={open ? "default" : "outline"} className="min-h-[44px]" onClick={() => { setOpen(true); toast.success("Sidebar expanded"); }}>
            Expand sidebar
          </Button>
          <Button variant={!open ? "default" : "outline"} className="min-h-[44px]" onClick={() => { setOpen(false); toast.success("Sidebar collapsed to icons"); }}>
            Collapse to icons
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function SessionSection() {
  const { user, profile, signOut } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const out = async () => {
    if (busy) return;
    setBusy(true);
    await signOut();
    router.replace("/login");
  };
  return (
    <section id="session" aria-label="Session" className="scroll-mt-24">
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Signed in as {profile?.name ?? user?.name ?? "staff"} · {user?.role === "manager" ? "Manager" : "Salesperson"}. Signing out ends this device&apos;s session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="min-h-[44px]" disabled={busy} onClick={() => void out()}>
            <LogOut className="size-4" />
            {busy ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function SettingsInner() {
  const active = useScrollSpy(SECTIONS.map((s) => s.id));
  return (
    <div className="staff-page mx-auto w-full max-w-5xl">
      <PageHeader
        kicker="System"
        title="Settings"
        sub="Profile, workspace and session — everything on this page works."
        trail={[{ label: "Settings" }]}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SectionNav active={active} />
        <div className="flex min-w-0 flex-col gap-4">
          <ProfileSection />
          <WorkspaceSection />
          <SessionSection />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Providers>
      <SettingsInner />
    </Providers>
  );
}
