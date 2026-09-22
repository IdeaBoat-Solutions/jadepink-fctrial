"use client";

/* Client island for the boutique landing:
   - adds .js to <html> so .reveal elements hide until revealed (no-JS safe)
   - reveals .reveal elements on first intersection (stagger via --d)
   - buttery section-to-section anchor glides: click handling per-anchor with
     scrollIntoView({ behavior: "smooth" }) — never a global
     `scroll-behavior: smooth` on <html> (that fights router scroll
     restoration + makes every programmatic scroll laggy on mobile Safari).
   - MutationObserver picks up late .reveal nodes (e.g. newsletter success).
   - everything is transform/opacity only, rAF-batched, reduced-motion safe. */

import { useEffect } from "react";

export function SiteMotion() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");

    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const reveal = (el: HTMLElement) => el.classList.add("is-in");

    let io: IntersectionObserver | null = null;
    const observed = new WeakSet<Element>();

    const observe = (els: Iterable<Element>) => {
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.classList.contains("is-in") || observed.has(el)) continue;
        observed.add(el);
        if (!("IntersectionObserver" in window)) {
          reveal(el);
        } else {
          io?.observe(el);
        }
      }
    };

    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              reveal(e.target as HTMLElement);
              io?.unobserve(e.target);
            }
          }
        },
        // Start the settle-in slightly before the section is fully visible
        // so arrivals feel instant, never catching up mid-scroll.
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
    }

    observe(document.querySelectorAll(".reveal, [data-sl-reveal]"));

    // Late-mounted reveals (newsletter success, etc.)
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((mutations) => {
            for (const m of mutations) {
              for (const node of m.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches?.(".reveal, [data-sl-reveal]")) observe([node]);
                const nested = node.querySelectorAll?.(".reveal, [data-sl-reveal]");
                if (nested?.length) observe(nested);
              }
            }
          })
        : null;
    mo?.observe(document.body, { childList: true, subtree: true });

    // Smooth anchor glides, scoped to in-page hashes only.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.('a[href^="#"]');
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;
      const target =
        hash === "#top"
          ? document.body
          : document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      // Keep URL in sync without the browser's jump-then-smooth double move.
      history.pushState(null, "", hash);
      if (reduceMotion) {
        (target as HTMLElement).scrollIntoView({ block: "start" });
      } else {
        (target as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      // Move focus for keyboard / screen-reader users (no focus ring flash).
      if (target instanceof HTMLElement && target.id !== "top") {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      io?.disconnect();
      mo?.disconnect();
      document.removeEventListener("click", onClick);
      root.classList.remove("js");
    };
  }, []);

  return null;
}
