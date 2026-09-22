"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function BackgroundBeams({ className }: { className?: string }) {
  const beams = [
    { left: "8%", duration: "9s", delay: "0s", height: "220px" },
    { left: "28%", duration: "12s", delay: "1.5s", height: "320px" },
    { left: "52%", duration: "10s", delay: "0.8s", height: "260px" },
    { left: "74%", duration: "13s", delay: "2.2s", height: "300px" },
    { left: "90%", duration: "8s", delay: "0.4s", height: "200px" },
  ];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(180,35,77,0.14),transparent_60%)]" />
      <div className="absolute inset-0 dot-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {beams.map((b, i) => (
        <span
          key={i}
          className="beam-fall absolute top-[-30%] w-px bg-gradient-to-b from-transparent via-[#b4234d]/40 to-transparent motion-safe:animate-[beam-fall_linear_infinite] motion-reduce:animate-none"
          style={{ left: b.left, height: b.height, animationDuration: b.duration, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}

export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 dot-grid-dark [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black_20%,transparent_100%)]" />
      <div className="absolute left-1/2 top-[-120px] h-[280px] w-[560px] -translate-x-1/2 rounded-full bg-[#b4234d]/25 blur-[120px]" />
      <div className="absolute right-[10%] top-[20%] h-[180px] w-[280px] rounded-full bg-violet-600/20 blur-[100px]" />
    </div>
  );
}
