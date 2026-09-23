"use client";

import { useEffect } from "react";

/* Per-route tab titles for client pages (which cannot export metadata).
   Appends the same " · JadePink" suffix as the root title template so every
   staff tab reads e.g. "Live floor · JadePink" instead of the default. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · JadePink`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
