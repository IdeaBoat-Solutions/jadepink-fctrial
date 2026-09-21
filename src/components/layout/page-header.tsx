import { cn } from "@/lib/utils";

export function PageHeader({ kicker, title, sub, actions, className }: {
  kicker?: string; title: string; sub?: string; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {kicker && <p className="staff-kicker">{kicker}</p>}
        <h1 className="staff-title mt-1">{title}</h1>
        {sub && <p className="staff-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
