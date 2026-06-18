import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

function getThemeLabel(theme: ThemePreference) {
  return themeOptions.find((option) => option.value === theme)?.label ?? "System";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [announcement, setAnnouncement] = useState("");
  const previousTheme = useRef({ theme, resolvedTheme });

  const activeOption = useMemo(
    () => themeOptions.find((option) => option.value === theme) ?? themeOptions[2],
    [theme]
  );
  const ActiveIcon = activeOption.Icon;
  const currentLabel = getThemeLabel(theme);
  const resolvedLabel = resolvedTheme === "dark" ? "Dark" : "Light";

  useEffect(() => {
    const previous = previousTheme.current;
    previousTheme.current = { theme, resolvedTheme };

    if (previous.theme === theme && previous.resolvedTheme === resolvedTheme) {
      return;
    }

    const message =
      theme === "system"
        ? `Theme changed to System, currently ${resolvedLabel}.`
        : `Theme changed to ${currentLabel}.`;
    setAnnouncement(message);
  }, [currentLabel, resolvedLabel, resolvedTheme, theme]);

  return (
    <div className={cn("relative", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Theme: ${currentLabel}${
              theme === "system" ? `, currently ${resolvedLabel}` : ""
            }. Open theme menu.`}
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-border-subtle bg-surface/90 text-text-secondary shadow-sm backdrop-blur transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <ActiveIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as ThemePreference)}
          >
            {themeOptions.map(({ value, label, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon aria-hidden="true" className="mr-2 h-4 w-4" />
                <span>{label}</span>
                {value === "system" && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {resolvedLabel}
                  </span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
