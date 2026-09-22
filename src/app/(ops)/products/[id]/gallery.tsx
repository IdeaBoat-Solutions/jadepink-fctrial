"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Product photo gallery: every photo on top, thumbnails below to switch.
   Plain img (per-project storage hosts, same as the rest of the floor UI). */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-[#f1ece4]">
        <span aria-hidden className="text-[56px] font-bold text-[#a8a094]">{(name || "?").slice(0, 1)}</span>
      </div>
    );
  }
  const current = images[Math.min(active, images.length - 1)];
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[#e9e2d8] bg-[#f6f2ec]">
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts */}
        <img src={current} alt={name} className="aspect-[4/3] w-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Product photos">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              aria-label={`Photo ${i + 1} of ${images.length}`}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === active ? "border-[#23403a]" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts */}
              <img src={src} alt="" className="size-16 object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Returns to wherever the FC came from (floor visit, catalogue) instead of a
   fixed page, so the visit context is never lost. */
export function BackButton({ fallback = "/products" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.replace(fallback);
      }}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#f1ece4] px-4 text-[13.5px] font-bold text-[#211d18] transition-colors hover:bg-[#e7dfd3]"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
