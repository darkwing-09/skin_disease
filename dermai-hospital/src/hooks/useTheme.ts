import { useContext } from "react";
import { ThemeContext } from "@/context/theme-context";
import type { ThemePreference, ResolvedTheme } from "@/context/theme-context";

export type { ThemePreference, ResolvedTheme };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
