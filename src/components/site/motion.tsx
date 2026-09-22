"use client";

/* Client island for the boutique landing:
   - adds .js to <html> so .reveal elements hide until revealed (no-JS safe)
   - adds .is-in to .reveal elements on first intersection (stagger via --d)
   - smooth anchor scrolling, page-scoped so ops/admin are untouched
   - legacy [data-sl-reveal] observer kept harmless for old markup */

import { useEffect } from "react";

export function SiteMotion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");

    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";

    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal, [data-sl-reveal]"),
    );
    let io: IntersectionObserver | null = null;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
    } else if (els.length > 0) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              io?.unobserve(e.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      els.forEach((el) => io?.observe(el));
    }

    return () => {
      io?.disconnect();
      root.style.scrollBehavior = prev;
      root.classList.remove("js");
    };
  }, []);

  return null;
}
