"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function BackgroundBeams({ className }: { className?: string }) {
  const beams = [
    { left: "8%", duration: 9, delay: 0, height: "220px" },
    { left: "28%", duration: 12, delay: 1.5, height: "320px" },
    { left: "52%", duration: 10, delay: 0.8, height: "260px" },
    { left: "74%", duration: 13, delay: 2.2, height: "300px" },
    { left: "90%", duration: 8, delay: 0.4, height: "200px" },
  ];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(180,35,77,0.14),transparent_60%)]" />
      <div className="absolute inset-0 dot-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {beams.map((b, i) => (
        <motion.span
          key={i}
          className="absolute top-[-30%] w-px bg-gradient-to-b from-transparent via-[#b4234d]/40 to-transparent"
          style={{ left: b.left, height: b.height }}
          animate={{ y: ["0vh", "130vh"] }}
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: "linear" }}
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
