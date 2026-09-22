"use client";

/* Unified customer search — ONE implementation for every surface that needs
   "type a name or mobile, get live matches, fall back to create".

   Before this hook the debounce + explicit-search + stale-guard pattern was
   hand-rolled three times (dashboard QuickFind, /customers, the visit identify
   flow) and each copy drifted. The visit-flow copy had a real race: the
   type-ahead debounce could fire AFTER the explicit Search tap, win the
   request-sequence guard, and silently drop the Search's create-form prefill —
   so the form opened empty and the visit stayed "Unidentified customer".

   The fix lives here once: an explicit search() sets `explicitInFlight`, and
   any quiet (debounced) lookup that starts while one is in flight is dropped
   instead of superseding it. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { normalizeMobile } from "@/lib/domain";
import type { CustomerSnapshotLive } from "@/lib/api";

export interface CustomerSearchError {
  title: string;
  body: string;
}

export interface UseCustomerSearch {
  /** Raw search text (what the operator typed). */
  query: string;
  /** Update the query; clears `submitted` + `error` so the form re-arms. */
  setQuery: (q: string) => void;
  /** Digits extracted from the query (mobile detection / prefill). */
  digits: string;
  /** True when the query contains letters (a name search, not pure digits). */
  hasLetters: boolean;
  /** True while any lookup is in flight. */
  searching: boolean;
  /** True once at least one lookup has resolved (suggestions may show). */
  searched: boolean;
  /** True once the operator has explicitly tapped Search. */
  submitted: boolean;
  /** De-duplicated matches — the unique mobile hit first, then name matches. */
  results: CustomerSnapshotLive[];
  /** Set by an explicit Search on failure; cleared on the next Search. */
  error: CustomerSearchError | null;
  /** Fire the explicit search (the Search button). Always wins over debounce. */
  search: () => void;
  /** Clear everything (e.g. after a successful create + attach). */
  reset: () => void;
  /** Mobile digits from the query, for prefilling the create form. */
  prefillMobile: string;
  /** Name from the query (only when it has letters), for prefilling. */
  prefillName: string;
}

export function useCustomerSearch(): UseCustomerSearch {
  const { searchCustomer, searchCustomersByName } = useStore();
  const [query, setQueryRaw] = useState("");
  const [results, setResults] = useState<CustomerSnapshotLive[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<CustomerSearchError | null>(null);

  /* Monotonic sequence: the newest lookup wins. `explicitInFlight` additionally
     stops a late debounce from superseding an in-flight explicit Search. */
  const req = useRef(0);
  const explicitInFlight = useRef(false);

  const runLookup = useCallback(async (raw: string, quiet: boolean) => {
    const q = raw.trim();
    const d = normalizeMobile(q);
    const letters = /[a-zA-Z\u0900-\u097F]/.test(q);
    if (q.length < 2 && d.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    // A debounced lookup must never override an explicit Search in flight.
    if (quiet && explicitInFlight.current) return;

    const my = ++req.current;
    if (!quiet) explicitInFlight.current = true;
    setSearching(true);
    if (!quiet) setError(null);
    try {
      const [hit, list] = await Promise.all([
        d.length >= 3 ? searchCustomer(q) : Promise.resolve(null),
        letters || d.length < 6 ? searchCustomersByName(q) : Promise.resolve([]),
      ]);
      if (my !== req.current) return; // a newer lookup won
      setResults([...(hit ? [hit] : []), ...list.filter((c) => c.id !== hit?.id)]);
      setSearched(true);
      if (!quiet) setSubmitted(true);
    } catch {
      if (my !== req.current) return;
      if (!quiet) setError({ title: "Search didn't go through.", body: "Check your connection and try again." });
    } finally {
      if (my === req.current) {
        setSearching(false);
        if (!quiet) explicitInFlight.current = false;
      }
    }
  }, [searchCustomer, searchCustomersByName]);

  // Debounced type-ahead: quiet suggestions as the operator types.
  useEffect(() => {
    const t = window.setTimeout(() => void runLookup(query, true), 260);
    return () => window.clearTimeout(t);
  }, [query, runLookup]);

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    setSubmitted(false);
    setError(null);
  }, []);

  const search = useCallback(() => {
    const q = query.trim();
    const d = normalizeMobile(q);
    if (q.length < 2 && d.length < 3) {
      setError({ title: "Type a name or mobile number.", body: "2+ letters for a name, or the 10-digit mobile number." });
      return;
    }
    void runLookup(q, false);
  }, [query, runLookup]);

  const reset = useCallback(() => {
    req.current++; // invalidate any in-flight lookup
    explicitInFlight.current = false;
    setQueryRaw("");
    setResults([]);
    setSearching(false);
    setSearched(false);
    setSubmitted(false);
    setError(null);
  }, []);

  const digits = normalizeMobile(query);
  const hasLetters = /[a-zA-Z\u0900-\u097F]/.test(query.trim());

  return {
    query,
    setQuery,
    digits,
    hasLetters,
    searching,
    searched,
    submitted,
    results,
    error,
    search,
    reset,
    prefillMobile: digits,
    prefillName: hasLetters ? query.trim() : "",
  };
}
