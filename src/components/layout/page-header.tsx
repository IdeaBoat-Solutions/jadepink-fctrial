import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ kicker, title, sub, actions, className, trail }: {
  kicker?: string; title: string; sub?: string; actions?: React.ReactNode; className?: string;
  trail?: { label: string; href?: string }[];
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 flex-1 basis-56">
        {trail && trail.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            {trail.map((t, i) => (
              <span key={t.label} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-muted-foreground/50">/</span>}
                {t.href && i < trail.length - 1 ? (
                  <Link href={t.href} className="font-medium hover:text-foreground hover:underline">{t.label}</Link>
                ) : (
                  <span aria-current={i === trail.length - 1 ? "page" : undefined} className={i === trail.length - 1 ? "font-semibold text-foreground" : ""}>{t.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {kicker && <p className="staff-kicker">{kicker}</p>}
        <h1 className="staff-title mt-1">{title}</h1>
        {sub && <p className="staff-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
