"use client";

/* Spotlight command palette — ⌘K / Ctrl+K, type to filter, ↑↓ + Enter, Esc.
   Items are role-filtered by the caller so FCs never see manager routes. */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export interface CommandItem {
  href: string;
  label: string;
  group: string;
  keywords?: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface ShortcutItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export function AdminCommand({
  items,
  shortcuts,
  triggerClassName,
}: {
  items: CommandItem[];
  shortcuts?: ShortcutItem[];
  /** Optional class for the header trigger button. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

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

  const quick = useMemo(() => {
    if (shortcuts?.length) return shortcuts.slice(0, 6);
    return items.slice(0, 5).map((it) => ({
      label: it.label,
      href: it.href,
      icon: it.icon ?? Search,
    }));
  }, [shortcuts, items]);

  const showingShortcuts = q.trim().length === 0;

  // Reset query + highlight when opened. Deferred for React Compiler.
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
  }, [active]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const groups = useMemo(() => {
    const map = new Map<string, { item: CommandItem; index: number }[]>();
    filtered.forEach((item, index) => {
      const list = map.get(item.group) ?? [];
      list.push({ item, index });
      map.set(item.group, list);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
          triggerClassName
        )}
        aria-label="Search and jump (Command K)"
      >
        <Search className="size-3.5" />
        <span className="hidden lg:inline">Search…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-md"
          className={cn(
            "top-[14%] translate-y-0 gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[560px]",
            "data-open:zoom-in-95 data-closed:zoom-out-95"
          )}
          aria-label="Search and jump"
        >
          <DialogTitle className="sr-only">Search and jump</DialogTitle>

          <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#1c1917]/88 text-white shadow-[0_28px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="size-5 shrink-0 text-white/45" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (showingShortcuts) {
                    if (e.key === "Enter" && quick[0]) {
                      e.preventDefault();
                      go(quick[0].href);
                    }
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, Math.max(filtered.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    const it = filtered[active];
                    if (it) go(it.href);
                  }
                }}
                placeholder="Search pages, customers, floor…"
                aria-label="Search pages and actions"
                aria-expanded="true"
                aria-controls="admin-command-list"
                role="combobox"
                aria-autocomplete="list"
                className="h-14 w-full bg-transparent text-[16px] tracking-tight text-white outline-none placeholder:text-white/40"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setActive(0);
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <Kbd className="bg-white/10 text-white/55">esc</Kbd>
              )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {showingShortcuts ? (
                <motion.div
                  key="shortcuts"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="px-4 py-4"
                >
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Jump to
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {quick.map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <motion.button
                          key={s.href + s.label}
                          type="button"
                          onClick={() => go(s.href)}
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: reduceMotion ? 0 : i * 0.03, duration: 0.2 }}
                          className="group flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-none"
                        >
                          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-white/14 to-white/6 ring-1 ring-white/12 transition-transform duration-150 group-hover:scale-105 group-hover:ring-[#b4234d]/50">
                            <Icon className="size-5 text-white/85" />
                          </span>
                          <span className="line-clamp-1 text-[12px] font-medium text-white/70 group-hover:text-white">
                            {s.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  ref={listRef}
                  id="admin-command-list"
                  role="listbox"
                  className="max-h-[360px] overflow-y-auto p-2"
                >
                  {filtered.length === 0 && (
                    <p className="px-3 py-10 text-center text-[13.5px] text-white/45">
                      No matches for “{q.trim()}”.
                    </p>
                  )}
                  {groups.map(([group, rows]) => (
                    <div key={group} className="mb-1.5">
                      <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                        {group}
                      </p>
                      {rows.map(({ item: it, index: i }) => {
                        const Icon = it.icon;
                        const selected = i === active;
                        return (
                          <button
                            key={it.href + it.label}
                            type="button"
                            data-index={i}
                            role="option"
                            aria-selected={selected}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(it.href)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                              selected
                                ? "bg-[#b4234d] text-white shadow-[0_8px_24px_-12px_rgba(180,35,77,0.9)]"
                                : "text-white/90 hover:bg-white/8"
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-9 shrink-0 place-items-center rounded-xl ring-1",
                                selected
                                  ? "bg-white/15 ring-white/20"
                                  : "bg-white/8 ring-white/10"
                              )}
                            >
                              {Icon ? (
                                <Icon className="size-4" />
                              ) : (
                                <Search className="size-4 opacity-70" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium">{it.label}</span>
                              <span
                                className={cn(
                                  "block truncate text-[12px]",
                                  selected ? "text-white/75" : "text-white/40"
                                )}
                              >
                                {it.group}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <p className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5 text-[11.5px] text-white/40">
              <span>
                <Kbd className="bg-white/10 text-white/55">↑</Kbd>{" "}
                <Kbd className="bg-white/10 text-white/55">↓</Kbd> move
              </span>
              <span>
                <Kbd className="bg-white/10 text-white/55">↵</Kbd> open
              </span>
              <span className="ml-auto">
                <Kbd className="bg-white/10 text-white/55">esc</Kbd> close
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
