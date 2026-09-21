"use client";

/* Admin command palette — no new dependency (no cmdk in the tree).
   ⌘K / Ctrl+K toggles, type to filter, ↑↓ + Enter to jump, Esc closes.
   Items are role-filtered by the caller, so FCs never see manager routes. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface CommandItem {
  href: string;
  label: string;
  group: string;
  keywords?: string;
}

export function AdminCommand({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) =>
      `${i.label} ${i.group} ${i.keywords || ""}`.toLowerCase().includes(needle)
    );
  }, [q, items]);

  // Reset query + highlighted row when the palette opens. Deferred so setState
  // happens outside the effect body (React Compiler "set-state-in-effect").
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setQ("");
      setActive(0);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active ]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        aria-label="Search and jump (Command K)"
      >
        <Search className="size-3.5" />
        <span className="hidden lg:inline">Jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md" aria-label="Jump to a page">
          <DialogTitle className="sr-only">Jump to a page</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  const it = filtered[active];
                  if (it) go(it.href);
                }
              }}
              placeholder="Type a page or action…"
              aria-label="Type a page or action"
              aria-expanded="true"
              aria-controls="admin-command-list"
              role="combobox"
              aria-autocomplete="list"
              className="h-12 w-full bg-transparent text-[14.5px] outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                onClick={() => { setQ(""); setActive(0); }}
                aria-label="Clear search"
                className="rounded-md px-1.5 py-1 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
          <div ref={listRef} id="admin-command-list" role="listbox" className="max-h-[320px] overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-3 py-8 text-center text-[13.5px] text-muted-foreground">
                No page matches “{q.trim()}”.
              </p>
            )}
            {filtered.map((it, i) => (
              <button
                key={it.href + it.label}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[14px]",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground"
                )}
              >
                <span className="font-medium">{it.label}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{it.group}</span>
              </button>
            ))}
          </div>
          <p className="border-t px-4 py-2 text-[12px] text-muted-foreground">
            ↑↓ to move · Enter to jump · Esc to close
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
