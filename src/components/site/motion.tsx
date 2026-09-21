"use client";

/* One tiny client island for the whole public page:
   - observes [data-sl-reveal] elements and adds .is-in on first intersection
   - tracks scroll state for the frosted nav border
   Zero framer-motion dependency on the public route. GPU-only reveals. */

import { useEffect } from "react";

export function SiteMotion() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-sl-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    els.forEach((el) => io.observe(el));

    const onScroll = () => {
      document.documentElement.dataset.slScrolled = window.scrollY > 8 ? "1" : "0";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
