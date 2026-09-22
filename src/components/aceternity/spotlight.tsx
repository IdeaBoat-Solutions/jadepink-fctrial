"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export function Spotlight({ className, fill = "white" }: { className?: string; fill?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute z-[1] h-[169%] w-[138%] animate-spotlight opacity-0 lg:w-[84%]", className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#spotlight-filter)">
        <ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501" transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)" fill={fill} fillOpacity="0.21" />
      </g>
      <defs>
        <filter id="spotlight-filter" x="0.860352" y="0.838989" width="3785.16" height="2840.26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}

export function CardSpotlight({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        // rAF-throttled + direct DOM write: no React re-render per pixel,
        // so hovering KPI cards never janks the dashboard.
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => {
          const host = ref.current;
          const glow = glowRef.current;
          if (!host || !glow) return;
          const r = host.getBoundingClientRect();
          glow.style.opacity = "1";
          glow.style.background = `radial-gradient(480px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(180,35,77,0.12), transparent 65%)`;
        });
      }}
      onMouseEnter={() => {
        if (glowRef.current) glowRef.current.style.opacity = "1";
      }}
      onMouseLeave={() => {
        cancelAnimationFrame(raf.current);
        if (glowRef.current) glowRef.current.style.opacity = "0";
      }}
      className={cn("group relative overflow-hidden", className)}
    >
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}
