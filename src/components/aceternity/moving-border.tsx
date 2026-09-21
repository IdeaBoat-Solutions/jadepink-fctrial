"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function MovingBorderButton({
  children,
  className,
  containerClassName,
  borderClassName,
  duration = 3000,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  containerClassName?: string;
  borderClassName?: string;
  duration?: number;
}) {
  return (
    <button
      {...props}
      className={cn("relative overflow-hidden rounded-xl p-[1.5px]", containerClassName)}
    >
      <span
        aria-hidden
        className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#b4234d_0%,#f3c4d3_30%,transparent_50%,#7c3aed_70%,#b4234d_100%)]"
        style={{ animationDuration: `${duration}ms` }}
      />
      <span className={cn("relative flex items-center justify-center gap-2 rounded-[10px] bg-[#1c1917] px-5 py-2.5 text-[14px] font-semibold text-white", className, borderClassName)}>
        {children}
      </span>
    </button>
  );
}

export function TextGenerateEffect({ words, className }: { words: string; className?: string }) {
  const list = words.split(" ");
  return (
    <span className={cn("inline", className)}>
      {list.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="inline-block"
        >
          {w}
          {i < list.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}
