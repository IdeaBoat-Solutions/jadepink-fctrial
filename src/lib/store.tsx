"use client";

/* Stage 2 live store. Same useStore() contract as the demo version so every
   page keeps working, but every operation now calls the Supabase-backed API
   routes. Perceived performance (§7): optimistic state updates with rollback
   on failure; toasts acknowledge within a frame, never "Loading…" freezes. */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { formatMobileIN, normalizeMobile } from "@/lib/domain";
import {
  type CustomerSnapshotLive, type SalespersonLive, type StaffProfile, type VisitLive,
  assignFC, attachCustomer, cancelVisit, completeVisit, createCustomer, createWalkIn,
  getCustomerById, getMe, listActiveVisits, listSalespersons, searchCustomerByPhone, searchCustomersByName, startVisit,
  updateCustomerRecord,
} from "@/lib/api";

export interface SessionUser { name: string; role: "fc" | "manager"; id: string; email?: string | null; }
interface Toast { id: number; title: string; body?: string; }

export interface LiveCustomer extends CustomerSnapshotLive {
  displayMobile: string;
  visitsCount: number;
  purchasesCount: number;
}

interface StoreCtx {
  user: SessionUser | null;
  profile: StaffProfile | null;
  storeId: string | null;
  loadingSession: boolean;
  signIn: (name: string, role: "fc" | "manager") => void;
  signOut: () => Promise<void>;
  signOutViaSupabase: () => Promise<void>;
  customers: LiveCustomer[];
  salespeople: SalespersonLive[];
  visits: VisitLive[];
  toasts: Toast[];
  online: boolean;
  pushToast: (title: string, body?: string) => void;
  dismissToast: (id: number) => void;
  createWalkIn: () => Promise<VisitLive | null>;
  searchCustomer: (q: string) => Promise<CustomerSnapshotLive | null>;
  /** Name lookup — every close match, so same names are picked by mobile. */
  searchCustomersByName: (name: string) => Promise<CustomerSnapshotLive[]>;
  /** Reads one record from the database and caches it. null = no such record. */
  fetchCustomer: (id: string) => Promise<CustomerSnapshotLive | null>;
  createCustomer: (input: { name: string; mobile: string; source?: string; area?: string; budget?: string }) => Promise<{ ok: true; customer: CustomerSnapshotLive } | { ok: false; code: string; message?: string }>;
  updateCustomer: (id: string, input: { name?: string; phone?: string; source?: string; area?: string; budget?: string; tier?: string | null }) => Promise<{ ok: true; customer: { id: string; name: string; phone: string; tier: string | null } } | { ok: false; code: string; message?: string }>;
  attachCustomerToVisit: (visitId: string, customerId: string) => Promise<{ ok: boolean; code?: string; message?: string }>;
  assignSalesperson: (visitId: string, spId: string) => Promise<{ ok: boolean; code?: string; message?: string }>;
  startVisit: (visitId: string) => Promise<{ ok: boolean; code?: string; message?: string }>;
  completeVisit: (visitId: string) => Promise<boolean>;
  abandonVisit: (visitId: string) => Promise<void>;
  getVisit: (id: string) => VisitLive | undefined;
  getCustomer: (id: string) => LiveCustomer | undefined;
  activeVisits: VisitLive[];
  awaitingAssignment: VisitLive[];
  todayCounts: { walkIns: number; active: number; completed: number; awaiting: number };
}

const Ctx = createContext<StoreCtx | null>(null);

/* Local session mirror so nav chrome renders instantly; truth stays in the
   Supabase session. getMe() is authoritative on mount. */
const LS_USER = "jadepink-session-v1";

function mapRole(role: StaffProfile["role"] | undefined): "fc" | "manager" {
  return role === "STORE_MANAGER" || role === "ADMIN" || role === "MANAGEMENT" ? "manager" : "fc";
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [salespeople, setSalespeople] = useState<SalespersonLive[]>([]);
  const [visits, setVisits] = useState<VisitLive[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const toastId = useRef(1);

  /* ---------- Session ---------- */

  const applySession = useCallback((p: StaffProfile | null, email?: string | null) => {
    setProfile(p);
    if (email !== undefined) setSessionEmail(email);
    try {
      if (p) localStorage.setItem(LS_USER, JSON.stringify(p));
      else localStorage.removeItem(LS_USER);
    } catch { /* ignore */ }
    setLoadingSession(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const r = await getMe();
    applySession(r.ok && r.data.user && r.data.profile ? r.data.profile : null, r.ok ? r.data.user?.email ?? null : null);
  }, [applySession]);

  // Initial session load — setState runs after the await, never synchronously
  // in the effect body (React Compiler "set-state-in-effect").
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getMe();
      if (cancelled) return;
      const p = r.ok && r.data.user && r.data.profile ? r.data.profile : null;
      setProfile(p);
      setSessionEmail(r.ok ? r.data.user?.email ?? null : null);
      try {
        if (p) localStorage.setItem(LS_USER, JSON.stringify(p));
        else localStorage.removeItem(LS_USER);
      } catch { /* ignore */ }
      setLoadingSession(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const user: SessionUser | null = useMemo(() => {
    if (!profile) return null;
    const fallback = sessionEmail?.trim() ? sessionEmail.split("@")[0] : "Staff";
    return {
      id: profile.id,
      name: profile.name?.trim() ? profile.name : fallback,
      role: mapRole(profile.role),
      email: sessionEmail,
    };
  }, [profile, sessionEmail]);

  const signOutViaSupabase = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => undefined);
    setProfile(null);
    setSessionEmail(null);
    try { localStorage.removeItem(LS_USER); } catch { /* ignore */ }
  }, []);

  const signOut = signOutViaSupabase;

  /* ---------- Toasts ---------- */

  const pushToast = useCallback((title: string, body?: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, title, body }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  /* ---------- Data loading ---------- */

  // Load today's visits + the FC list whenever the store changes. setState runs
  // after the awaits — never synchronously in the effect body.
  useEffect(() => {
    const storeId = profile?.storeId;
    if (!storeId) return;
    let cancelled = false;
    void (async () => {
      const [v, s] = await Promise.all([listActiveVisits(storeId), listSalespersons(storeId)]);
      if (cancelled) return;
      if (v.ok) setVisits(v.data);
      if (s.ok) setSalespeople(s.data);
    })();
    return () => { cancelled = true; };
  }, [profile?.storeId]);

  /* ---------- Online state ---------- */

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* ---------- Operations (optimistic + rollback) ---------- */

  const createWalkInOp = useCallback(async (): Promise<VisitLive | null> => {
    const storeId = profile?.storeId;
    if (!storeId) {
      // Never fail silently here: every caller returns on null, so an
      // unassigned store would otherwise look like a dead button.
      pushToast("Could not record walk-in", "Your account has no store assigned. Ask your manager to assign one.");
      return null;
    }
    const r = await createWalkIn(storeId);
    if (!r.ok) {
      pushToast("Could not record walk-in", r.message);
      return null;
    }
    setVisits((prev) => [r.data, ...prev.filter((v) => v.id !== r.data.id)]);
    return r.data;
  }, [profile, pushToast]);

  const searchCustomerOp = useCallback(async (q: string): Promise<CustomerSnapshotLive | null> => {
    const digits = normalizeMobile(q);
    if (digits.length < 3 && q.trim().length < 3) return null;
    const r = await searchCustomerByPhone(digits.length >= 3 ? digits : q.trim());
    return r.ok ? r.data : null;
  }, []);

  const searchCustomersByNameOp = useCallback(async (name: string): Promise<CustomerSnapshotLive[]> => {
    if (name.trim().length < 2) return [];
    const r = await searchCustomersByName(name.trim());
    return r.ok && Array.isArray(r.data) ? r.data : [];
  }, []);

  /* Single-record read. The cache only holds customers seen in today's visits,
     so anything reached by URL, reload or history link is resolved from the
     database and remembered locally. CUSTOMER_NOT_FOUND (404) → null, which is
     the signal the UI uses to offer record creation instead of a blank page. */
  const fetchCustomerOp = useCallback(async (id: string): Promise<CustomerSnapshotLive | null> => {
    const r = await getCustomerById(id);
    if (!r.ok) return null;
    const c = r.data;
    setCustomers((prev) => (
      prev.some((x) => x.id === c.id)
        ? prev
        : [
            { ...c, displayMobile: formatMobileIN(c.phone), visitsCount: c.visitCount, purchasesCount: c.purchaseCount },
            ...prev,
          ]
    ));
    return c;
  }, []);

  const createCustomerOp = useCallback(async (input: { name: string; mobile: string; source?: string; area?: string; budget?: string }) => {
    const r = await createCustomer({ name: input.name, phone: input.mobile, source: input.source, area: input.area, budget: input.budget });
    if (!r.ok) return { ok: false as const, code: r.code, message: r.message };
    const c = r.data;
    setCustomers((prev) => [
      {
        id: c.id,
        name: c.name,
        phone: c.phone,
        visitCount: 0,
        lastVisitAt: null,
        purchaseCount: 0,
        displayMobile: formatMobileIN(c.phone),
        visitsCount: 0,
        purchasesCount: 0,
      },
      // Dedupe by id — a customer must never appear twice in the list.
      ...prev.filter((x) => x.id !== c.id),
    ]);
    return {
      ok: true as const,
      customer: { id: c.id, name: c.name, phone: c.phone, visitCount: 0, lastVisitAt: null, purchaseCount: 0, tier: null },
    };
  }, []);

  const updateCustomerOp = useCallback(async (id: string, input: { name?: string; phone?: string; source?: string; area?: string; budget?: string; tier?: string | null }) => {
    const r = await updateCustomerRecord(id, input);
    if (!r.ok) return { ok: false as const, code: r.code, message: r.message };
    const c = r.data;
    setCustomers((prev) => prev.map((x) => (
      x.id === c.id
        ? { ...x, name: c.name, phone: c.phone, displayMobile: formatMobileIN(c.phone), tier: c.tier }
        : x
    )));
    return { ok: true as const, customer: c };
  }, []);

  const attachCustomerOp = useCallback(async (visitId: string, customerId: string) => {
    const r = await attachCustomer(visitId, customerId);
    if (!r.ok) return { ok: false as const, code: r.code, message: r.message };
    setVisits((prev) => prev.map((v) => (v.id === visitId ? r.data : v)));
    return { ok: true as const };
  }, []);

  const assignOp = useCallback(async (visitId: string, spId: string) => {
    const prev = visits.find((v) => v.id === visitId);
    // Optimistic: show the assignment immediately (§7)
    setVisits((all) => all.map((v) => (v.id === visitId ? { ...v, assignedSalespersonId: spId, status: prev && v.status === "IDENTIFYING" ? "ASSIGNED" : v.status } : v)));
    const r = await assignFC(visitId, spId);
    if (!r.ok) {
      // Rollback
      setVisits((all) => all.map((v) => (v.id === visitId ? prev ?? v : v)));
      return { ok: false as const, code: r.code, message: r.message };
    }
    setVisits((all) => all.map((v) => (v.id === visitId ? r.data : v)));
    return { ok: true as const };
  }, [visits]);

  const startVisitOp = useCallback(async (visitId: string) => {
    const prev = visits.find((v) => v.id === visitId);
    setVisits((all) => all.map((v) => (v.id === visitId ? { ...v, status: "ACTIVE" as const, startedAt: v.startedAt ?? new Date().toISOString() } : v)));
    const r = await startVisit(visitId);
    if (!r.ok) {
      setVisits((all) => all.map((v) => (v.id === visitId ? prev ?? v : v)));
      return { ok: false as const, code: r.code, message: r.message };
    }
    setVisits((all) => all.map((v) => (v.id === visitId ? r.data : v)));
    return { ok: true as const };
  }, [visits]);

  const completeVisitOp = useCallback(async (visitId: string): Promise<boolean> => {
    const r = await completeVisit(visitId);
    if (!r.ok) {
      pushToast("Could not complete visit", r.message);
      return false;
    }
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
    return true;
  }, [pushToast]);

  const abandonVisitOp = useCallback(async (visitId: string) => {
    const r = await cancelVisit(visitId);
    if (!r.ok) {
      pushToast("Could not end visit", r.message);
      return;
    }
    setVisits(() => visits.filter((v) => v.id !== visitId));
  }, [visits, pushToast]);

  /* ---------- Lookups ---------- */

  const getVisit = useCallback((id: string) => visits.find((v) => v.id === id), [visits]);
  const getCustomer = useCallback((id: string) => customers.find((c) => c.id === id), [customers]);

  const { activeVisits, awaitingAssignment, todayCounts } = useMemo(() => {
    const active = visits.filter((v) => v.status === "ACTIVE" || v.status === "ASSIGNED");
    const awaiting = visits.filter((v) => v.status === "IDENTIFYING" || v.status === "ARRIVED" || ((v.status === "ASSIGNED" || v.status === "ACTIVE") && !v.assignedSalespersonId));
    return {
      activeVisits: active,
      awaitingAssignment: awaiting,
      todayCounts: {
        walkIns: visits.length,
        active: visits.filter((v) => v.status === "ACTIVE").length,
        completed: visits.filter((v) => v.status === "COMPLETED").length,
        awaiting: awaiting.length,
      } as { walkIns: number; active: number; completed: number; awaiting: number },
    };
  }, [visits]);

  const value: StoreCtx = {
    user, profile, storeId: profile?.storeId ?? null, loadingSession,
    signIn: (name, role) => {
      // Session mirror until getMe() confirms; role resolved server-side.
      setProfile((p) => p ?? { id: "", name, role: role === "manager" ? "STORE_MANAGER" : "FC", storeId: null });
      void refreshSession();
    },
    signOut, signOutViaSupabase,
    customers, salespeople, visits, toasts, online, pushToast, dismissToast,
    createWalkIn: createWalkInOp,
    searchCustomer: searchCustomerOp,
    searchCustomersByName: searchCustomersByNameOp,
    fetchCustomer: fetchCustomerOp,
    createCustomer: createCustomerOp,
    updateCustomer: updateCustomerOp,
    attachCustomerToVisit: attachCustomerOp,
    assignSalesperson: assignOp,
    startVisit: startVisitOp,
    completeVisit: completeVisitOp,
    abandonVisit: abandonVisitOp,
    getVisit, getCustomer,
    activeVisits, awaitingAssignment, todayCounts,
  } as StoreCtx;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
