import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from "@/context/theme-context";

const THEME_STORAGE_KEY = "dermai-theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

function getInitialPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(storedTheme)) return storedTheme;
  } catch {
    // localStorage can be unavailable in strict privacy modes.
  }

  const attributeTheme = document.documentElement.dataset.themePreference;
  return isThemePreference(attributeTheme) ? attributeTheme : "system";
}

function applyTheme(theme: ResolvedTheme, withTransition: boolean) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (withTransition && !reduceMotion) {
    root.classList.add("theme-transitioning");
    window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 220);
  }

  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    getInitialPreference()
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialPreference())
  );
  const themeRef = useRef(theme);

  const syncTheme = useCallback(
    (nextTheme: ThemePreference, withTransition: boolean) => {
      const nextResolvedTheme = resolveTheme(nextTheme);
      themeRef.current = nextTheme;
      setThemeState(nextTheme);
      setResolvedTheme(nextResolvedTheme);
      document.documentElement.dataset.themePreference = nextTheme;
      applyTheme(nextResolvedTheme, withTransition);
    },
    []
  );

  const setTheme = useCallback(
    (nextTheme: ThemePreference) => {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // The in-memory state still updates if persistence is unavailable.
      }

      syncTheme(nextTheme, true);
    },
    [syncTheme]
  );

  useEffect(() => {
    themeRef.current = theme;
    document.documentElement.dataset.themePreference = theme;
    applyTheme(resolvedTheme, false);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);

    function handleSystemThemeChange() {
      if (themeRef.current !== "system") return;
      const nextResolvedTheme = getSystemTheme();
      setResolvedTheme(nextResolvedTheme);
      applyTheme(nextResolvedTheme, true);
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      syncTheme(isThemePreference(event.newValue) ? event.newValue : "system", true);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
