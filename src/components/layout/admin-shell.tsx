"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, BarChart3,
  Settings, Store, LogOut, Boxes,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { useStore } from "@/lib/store";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { RouteFocus } from "@/components/layout/route-focus";

type Role = "fc" | "manager";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which shell the destination renders in — ops links switch chrome. */
  surface?: "ops";
  /** Restrict visibility; omitted = everyone. */
  roles?: Role[];
}

const NAV: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/today", label: "Today (floor)", icon: Store, surface: "ops" },
  ]},
  { title: "Catalogue", items: [
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/inventory/categories", label: "Categories", icon: Boxes },
    { href: "/suppliers", label: "Suppliers", icon: Truck },
  ]},
  { title: "Sales", items: [
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/customers", label: "Customers", icon: Users, surface: "ops" },
    { href: "/reports", label: "Reports", icon: BarChart3 },
  ]},
  { title: "System", items: [
    { href: "/settings", label: "Settings", icon: Settings, roles: ["manager"] },
  ]},
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useStore();

  return (
    <SidebarProvider>
      <a href="#main-content" className="skip-link">Skip to work</a>
      <Sidebar variant="inset">
        <SidebarHeader>
          <Link href="/dashboard" className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted">
            <img src="/logo.jpeg" alt="JadePink logo" className="h-8 w-auto shrink-0 object-contain rounded-xl" />
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-bold tracking-[0.14em]">JADEPINK</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">Store OS</span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Store navigation" className="flex flex-col">
            {NAV.map((g) => (
              <SidebarGroup key={g.title}>
                <SidebarGroupLabel>{g.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((it) => {
                      const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
                      return (
                        <SidebarMenuItem key={it.href}>
                          <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                            <Link href={it.href} aria-current={active ? "page" : undefined}>
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
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-2 text-[12px] text-muted-foreground">
            <span className="min-w-0 truncate font-medium">{user?.name ? `${user.name} · ${user.role}` : "Staff portal"}</span>
            <button onClick={signOut} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg px-2 font-semibold transition-colors hover:bg-background hover:text-foreground active:scale-[0.97]" title="Sign out">
              <LogOut className="size-3.5" /> Exit
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="main-content" tabIndex={-1} className="focus:outline-none">
        <header className="admin-bar sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger className="transition-transform duration-150 hover:scale-105 active:scale-95" />
          <span className="hidden truncate text-[13px] text-muted-foreground sm:inline">JadePink fullstack · dashboard / inventory / orders</span>
          <span className="ml-auto"><ModeToggle /></span>
        </header>
        <div className="staff-page flex-1 p-4 md:p-6 lg:p-8">
          <RouteFocus />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
