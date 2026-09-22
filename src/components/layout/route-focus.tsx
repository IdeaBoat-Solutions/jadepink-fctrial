"use client";

/* SPA orientation: on every route change, move focus to the main landmark
   (without scrolling) so screen-reader users land on the new page instantly
   and keyboard users start from a predictable place. Skips the first mount
   so initial page loads + autofocused inputs (login, walk-in search) win. */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteFocus({ targetId = "main-content" }: { targetId?: string }) {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }, [pathname, targetId]);

  return null;
}
