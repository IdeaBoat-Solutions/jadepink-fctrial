"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity, BarChart3, Briefcase, ClipboardList, LayoutDashboard,
  LogOut, Package, Plus, Settings, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { RouteFocus } from "@/components/layout/route-focus";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarSeparator, SidebarTrigger,
} from "@/components/ui/sidebar";

type Role = "fc" | "manager";

interface FloorNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

function routeLabel(pathname: string, role: Role): string {
  if (pathname.startsWith("/visits/")) return "Visit";
  if (pathname.startsWith("/visits")) return role === "manager" ? "Live floor · Visits" : "My visits";
  if (pathname.startsWith("/walk-in")) return "New walk-in";
  if (pathname.startsWith("/floor")) return "Live floor";
  if (pathname.startsWith("/today")) return role === "manager" ? "Store" : "My work";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/team")) return "Sales team";
  if (pathname.startsWith("/activity")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  return role === "manager" ? "Store" : "My work";
}

export function FloorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, toasts, online, dismissToast, pushToast, createWalkIn, activeVisits, awaitingAssignment } = useStore();
  const role: Role = user?.role === "manager" ? "manager" : "fc";
  const [creating, setCreating] = useState(false);
  const first = user?.name?.split(" ")[0] || "Staff";

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    const v = await createWalkIn();
    setCreating(false);
    if (!v) {
      pushToast("Could not record the walk-in", "Check your connection and try again.");
      return;
    }
    pushToast("Walk-in recorded", "Identify the customer next.");
    router.push(`/visits/${v.id}`);
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/today" && pathname.startsWith(href)) ||
    (href === "/floor" && pathname.startsWith("/visits/")) ||
    (href === "/visits" && pathname.startsWith("/visits/"));

  const floorGroup: FloorNavItem[] = [
    { href: "/today", label: "Dashboard", icon: LayoutDashboard },
    ...(role === "manager"
      ? [{ href: "/floor", label: "Live floor", icon: Activity, badge: awaitingAssignment.length } as FloorNavItem]
      : []),
    { href: "/visits", label: "My visits", icon: ClipboardList, badge: activeVisits.length || undefined },
  ];
  const storeGroup: FloorNavItem[] = [
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/products", label: "Products", icon: Package },
  ];
  const manageGroup: FloorNavItem[] = [
    { href: "/team", label: "Sales team", icon: Briefcase },
    { href: "/activity", label: "Reports", icon: BarChart3 },
  ];
  const prefsGroup: FloorNavItem[] = [
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const renderItem = (item: FloorNavItem) => {
    const active = isActive(item.href);
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
          <Link href={item.href} aria-current={active ? "page" : undefined}>
            <item.icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
        {typeof item.badge === "number" && item.badge > 0 && (
          <SidebarMenuBadge className="tnum bg-[var(--fp-brand-soft)] text-[var(--fp-brand-deep)]">
            {item.badge}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <div className="floor-os">
      <TooltipProvider delayDuration={200}>
        <SidebarProvider>
          <a href="#main-content" className="fp-skip">Skip to work</a>
          <Sidebar variant="sidebar" collapsible="icon" className="floor-sidebar">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" asChild tooltip="JadePink home">
                    <Link href="/today" aria-label="JadePink home">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--fp-ink)] text-[13px] font-semibold text-white">JP</span>
                      <span className="flex flex-col leading-none">
                        <span className="text-[12px] font-semibold tracking-[0.16em]">JADEPINK</span>
                        <span className="mt-1 text-[11px] font-normal text-[var(--fp-muted)]">Ahmedabad</span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Floor</SidebarGroupLabel>
                <SidebarGroupAction title="Record a walk-in" onClick={() => void newWalkIn()}>
                  <Plus />
                  <span className="sr-only">New walk-in</span>
                </SidebarGroupAction>
                <SidebarGroupContent>
                  <SidebarMenu>{floorGroup.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Store</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{storeGroup.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              {role === "manager" && (
                <SidebarGroup>
                  <SidebarGroupLabel>Manage</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>{manageGroup.map(renderItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
              <SidebarGroup>
                <SidebarGroupLabel>Preferences</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{prefsGroup.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator className="mx-2 w-auto bg-[var(--fp-line)]" />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => void newWalkIn()}
                        disabled={creating}
                        tooltip={creating ? "Recording walk-in…" : "Record a walk-in"}
                        className="border border-[var(--fp-line-strong)] bg-[var(--fp-surface)] font-semibold text-[var(--fp-ink)] hover:border-[var(--fp-ink)]"
                      >
                        <Plus />
                        <span>{creating ? "Recording…" : "New walk-in"}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" tooltip={`${first} · ${role === "manager" ? "Store manager" : "Sales"}`}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--fp-ink-soft)] text-[12px] font-bold text-[var(--fp-ink)]">
                      {first.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[12.5px] font-semibold">{first}</span>
                      <span className="block text-[11.5px] font-normal text-[var(--fp-muted)]">
                        {role === "manager" ? "Store manager" : "Sales"}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => void signOut()} tooltip="Sign out">
                    <LogOut />
                    <span>Sign out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="floor-main bg-transparent">
            {!online && (
              <p role="alert" className="bg-[var(--fp-wait)] px-4 py-2 text-center text-[13.5px] font-semibold text-white">
                Connection lost. Your last action may not have saved. Input on this screen is kept.
              </p>
            )}
            <header className="floor-top">
              <div className="flex min-w-0 items-center gap-1.5">
                <SidebarTrigger className="min-h-11 min-w-11 text-[var(--fp-muted)] hover:bg-[var(--fp-ink-soft)] hover:text-[var(--fp-ink)]" />
                <nav aria-label="Where you are" className="truncate text-[13px] text-[var(--fp-muted)]">
                  JadePink · Ahmedabad
                  <span className="mx-2 text-[var(--fp-line-strong)]">/</span>
                  <span className="text-[var(--fp-ink)]">{routeLabel(pathname, role)}</span>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-[13px] text-[var(--fp-muted)] sm:inline">{user?.name}</span>
              </div>
            </header>
            <main id="main-content" tabIndex={-1} className="floor-work focus:outline-none">
              <RouteFocus />
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="fp-rise pointer-events-auto flex items-start gap-3 border border-[var(--fp-ink)] bg-[var(--fp-ink)] px-4 py-3 text-white">
            <span aria-hidden className="mt-1 size-1.5 shrink-0 bg-[#8dcea8]" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{t.body}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label={`Dismiss ${t.title}`} className="min-h-11 px-2 text-[12px] font-semibold text-white/60 hover:text-white">
              Close
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
