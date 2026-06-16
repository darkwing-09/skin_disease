import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePercent(value: number | string | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.min(100, Math.max(0, percent));
}

export function formatPercentValue(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return `${(0).toFixed(fractionDigits)}%`;
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatConfidence(value: number | string | null | undefined): string {
  return formatPercentValue(normalizePercent(value));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
