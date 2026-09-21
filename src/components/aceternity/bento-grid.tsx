"use client";

import { cn } from "@/lib/utils";

export function BentoGrid({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-3 md:auto-rows-[minmax(120px,auto)]", className)}>
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs transition duration-200 hover:shadow-md hover:-translate-y-0.5",
        className
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-1">
        {icon}
        <div className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">{title}</div>
        <div className="mt-0.5 text-[13px] font-normal leading-relaxed text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
