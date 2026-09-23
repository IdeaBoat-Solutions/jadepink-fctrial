"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users, BarChart3,
  Settings, Store, LogOut, Boxes, Plus,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail,
  SidebarSeparator, SidebarTrigger, SidebarInset,
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

const NAV: { title: string; action?: { label: string; href: string }; items: NavItem[] }[] = [
  { title: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/today", label: "Today (floor)", icon: Store, surface: "ops" },
  ]},
  { title: "Catalogue", action: { label: "Add product", href: "/inventory/new" }, items: [
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
    { href: "/settings", label: "Settings", icon: Settings, surface: "ops" },
  ]},
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useStore();

  const section = pathname.startsWith("/inventory/categories")
    ? "Inventory / Categories"
    : pathname.startsWith("/inventory/new")
      ? "Inventory / New product"
      : pathname.startsWith("/inventory/")
        ? "Inventory / Product"
        : pathname.startsWith("/inventory")
          ? "Inventory"
          : pathname.startsWith("/orders")
            ? "Orders"
            : pathname.startsWith("/suppliers")
              ? "Suppliers"
              : pathname.startsWith("/reports")
                ? "Reports"
                : pathname.startsWith("/settings")
                  ? "Settings"
                  : pathname.startsWith("/dashboard")
                    ? "Dashboard"
                    : "Store OS";

  return (
    <SidebarProvider>
      <a href="#main-content" className="skip-link">Skip to work</a>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="JadePink dashboard">
                <Link href="/dashboard">
                  <img src="/logo.jpeg" alt="JadePink logo" className="h-8 w-auto shrink-0 rounded-xl object-contain" />
                  <span className="flex flex-col leading-none">
                    <span className="text-[13px] font-bold tracking-[0.14em]">JADEPINK</span>
                    <span className="mt-0.5 text-[11px] font-normal text-muted-foreground">Store OS</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Store navigation" className="flex flex-col">
            {NAV.map((g, gi) => (
              <div key={g.title}>
                {gi > 0 && <SidebarSeparator className="mx-2 w-auto" />}
                <SidebarGroup className="py-1">
                  <SidebarGroupLabel>{g.title}</SidebarGroupLabel>
                  {g.action && (
                    <SidebarGroupAction title={g.action.label} asChild>
                      <Link href={g.action.href} aria-label={g.action.label}>
                        <Plus />
                      </Link>
                    </SidebarGroupAction>
                  )}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {g.items
                        .filter((it) => !it.roles || (user && it.roles.includes(user.role as Role)))
                        .map((it) => {
                          const active = pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href));
                          return (
                            <SidebarMenuItem key={it.href}>
                              <SidebarMenuButton asChild isActive={active} tooltip={it.surface === "ops" ? `${it.label} · opens floor view` : it.label}>
                                <Link href={it.href} aria-current={active ? "page" : undefined}>
                                  <it.icon />
                                  <span>{it.label}</span>
                                  {it.surface === "ops" && (
                                    <span aria-hidden className="ml-auto text-[10px] text-muted-foreground">↗</span>
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip={user?.name ? `${user.name} · ${user.role}` : "Staff portal"}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-bold">
                  {(user?.name ?? "S").charAt(0)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[12.5px] font-semibold">{user?.name ?? "Staff portal"}</span>
                  <span className="block text-[11.5px] font-normal text-muted-foreground">{user?.role ?? "sign in to continue"}</span>
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
      <SidebarInset id="main-content" tabIndex={-1} className="focus:outline-none">
        <header className="admin-bar sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger className="transition-transform duration-150 hover:scale-105 active:scale-95" />
          <SidebarSeparator orientation="vertical" className="h-5" />
          <span className="hidden truncate text-[13px] text-muted-foreground sm:inline">JadePink Store OS · {section}</span>
          <span className="ml-auto flex items-center gap-2">
            <ModeToggle />
          </span>
        </header>
        <div className="staff-page flex-1 p-4 md:p-6 lg:p-8">
          <RouteFocus />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
