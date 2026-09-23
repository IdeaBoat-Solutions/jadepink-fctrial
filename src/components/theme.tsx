"use client";

/* Local theme manager — replaces next-themes.
   next-themes renders a raw <script> inside the React tree, which Next.js 16
   flags as "Encountered a script tag while rendering React component".
   This module never renders a script element: the pre-paint snippet lives in
   the root layout via next/script (beforeInteractive, the sanctioned path),
   and this provider only toggles the `dark` class at runtime.
   API mirrors next-themes: theme, setTheme, resolvedTheme, themes. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type StaffTheme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const THEMES: StaffTheme[] = ["light", "dark", "system"];

function systemIsDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): StaffTheme {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

type ThemeCtx = {
  theme: StaffTheme;
  resolvedTheme: "light" | "dark";
  themes: StaffTheme[];
  setTheme: (t: StaffTheme) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "light",
  resolvedTheme: "light",
  themes: THEMES,
  setTheme: () => {},
});

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<StaffTheme>(readStored);
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window === "undefined" ? false : systemIsDark(),
  );

  const resolvedTheme: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    apply(resolvedTheme);
  }, [resolvedTheme]);

  /* Follow the OS while "system" is active. */
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  /* Sync across tabs. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: StaffTheme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage blocked — theme still applies for this session */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, themes: THEMES, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* Pre-paint snippet for the root layout (next/script beforeInteractive).
   Same resolution as the provider so first paint never flashes. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme")||"light";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var d=document.documentElement;d.classList.remove("light","dark");d.classList.add(r);d.style.colorScheme=r;}catch(e){}})();`;
