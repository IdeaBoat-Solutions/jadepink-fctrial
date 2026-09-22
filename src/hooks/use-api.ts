"use client";

/* Runs one of the typed src/lib/api.ts readers and tracks its state, so an admin
   screen gets loading / error / data without re-implementing the cancel-on-
   unmount and ignore-stale-response logic every time.

   `key` is the dependency: pass a string that changes when the query changes
   (e.g. `${q}|${cat}|${page}`) and the loader re-runs. */

import { useCallback, useEffect, useState } from "react";
import type { ApiResult } from "@/lib/api";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  /** Never a raw Postgres string — api.ts maps failures to human copy. */
  error: string | null;
  reload: () => void;
}

export function useApi<T>(key: string, load: () => Promise<ApiResult<T>>): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /* New query (or manual reload) → back to loading, keeping the previous
     data on screen (stale-while-revalidate, no flash). The reset happens in
     render phase — the documented pattern — so no cascading effect renders. */
  const signature = `${key}|${nonce}`;
  const [activeSignature, setActiveSignature] = useState(signature);
  if (activeSignature !== signature) {
    setActiveSignature(signature);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await load();
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.message);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { data, loading, error, reload };
}

/** Debounce so typing in a search box does not fire one request per keystroke. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
