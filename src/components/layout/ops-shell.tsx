"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, BarChart3, LayoutDashboard, LogOut, Package,
  Plus, ShoppingCart, Sun, Users,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";
import { RouteFocus } from "@/components/layout/route-focus";
import { TooltipProvider } from "@/components/ui/tooltip";

type Role = "fc" | "manager";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Item runs an action instead of navigating (New walk-in). */
  action?: () => void;
  /** Destination renders in the admin chrome. */
  surface?: "admin";
  /** Restrict visibility; omitted = everyone. */
  roles?: Role[];
}

const NAV: { title: string; items: NavItem[] }[] = [
  { title: "Floor", items: [
    { href: "/today", label: "Today", icon: Sun },
    { href: "/floor", label: "Live floor", icon: Activity, roles: ["manager"] },
    { href: "/customers", label: "Customers", icon: Users },
  ]},
  { title: "Manage", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, surface: "admin", roles: ["manager"] },
    { href: "/reports", label: "Reports", icon: BarChart3, surface: "admin", roles: ["manager"] },
    { href: "/inventory", label: "Inventory", icon: Package, surface: "admin", roles: ["manager"] },
    { href: "/orders", label: "Orders", icon: ShoppingCart, surface: "admin", roles: ["manager"] },
  ]},
];

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, toasts, online, dismissToast, pushToast, createWalkIn } = useStore();
  const role: Role = user?.role === "manager" ? "manager" : "fc";

  const newWalkIn = async () => {
    pushToast("Recording walk-in…", "One moment.");
    const v = await createWalkIn();
    if (!v) {
      pushToast("Could not record walk-in", "Check your connection and try again.");
      return;
    }
    pushToast("Walk-in recorded", "Now identify the customer.");
    router.push(`/walk-in?visit=${v.id}`);
  };

  const visible = NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => !it.roles || it.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <Link href="/today" className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted">
            <span className="grid size-8 place-items-center rounded-xl bg-[#b4234d] text-[15px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(180,35,77,0.6)] transition-transform duration-150 group-hover:scale-105">J</span>
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-bold tracking-[0.14em]">JADEPINK</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">Floor · Thaltej</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => void newWalkIn()}
                    tooltip="New walk-in"
                    className="bg-[#b4234d] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(180,35,77,0.6)] transition-colors hover:bg-[#93183d] hover:text-white active:scale-[0.98]"
                  >
                    <Plus />
                    <span>New walk-in</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {visible.map((g) => (
            <SidebarGroup key={g.title}>
              <SidebarGroupLabel>{g.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((it) => {
                    const active = !!it.href && (pathname === it.href || (it.href !== "/today" && pathname.startsWith(it.href)));
                    return (
                      <SidebarMenuItem key={it.href ?? it.label}>
                        <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                          <Link href={it.href ?? "/today"}>
                            <it.icon />
                            <span>{it.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-2 text-[12px] text-muted-foreground">
            <span className="min-w-0 truncate font-medium">
              {user ? `${user.name} · ${role === "manager" ? "Manager" : "FC"}` : "Staff portal"}
            </span>
            <button onClick={signOut} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg px-2 font-semibold transition-colors hover:bg-background hover:text-foreground active:scale-[0.97]" title="Sign out">
              <LogOut className="size-3.5" /> Exit
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {!online && (
          <p role="alert" className="bg-[#7a4a00] px-4 py-2 text-center text-[13.5px] font-semibold text-white">
            Connection lost. Your changes haven&apos;t been saved — input is preserved.
          </p>
        )}
        <header className="ops-header sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-[#e8dfd6] bg-[#faf8f6]/90 px-4 backdrop-blur">
          <SidebarTrigger className="transition-transform duration-150 hover:scale-105 active:scale-95" />
          <span className="hidden truncate text-[13px] text-[#78716c] sm:inline">JadePink floor · today / live floor / customers</span>
        </header>
        <main id="main-content" tabIndex={-1} className="staff-page mx-auto w-full max-w-6xl flex-1 p-4 focus:outline-none sm:p-6">
          <RouteFocus />
          {children}
        </main>
        {/* Toasts: immediate acknowledgement, aria-live, never blocking */}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id} className="ui-rise pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#1c1917]/95 px-4 py-3 text-white shadow-[0_16px_40px_-12px_rgba(28,25,23,0.6)] backdrop-blur">
              <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#177245] text-[12px] font-bold text-white">✓</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-tight">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{t.body}</p>}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label={`Dismiss: ${t.title}`}
                className="grid min-h-[32px] w-8 shrink-0 place-items-center rounded-lg text-[13px] text-white/60 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
