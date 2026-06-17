export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceMeta {
  level: ConfidenceLevel;
  label: string;
  emoji: string;
  badgeClass: string;
}

export function getConfidenceLevel(confidence: number): ConfidenceMeta {
  if (confidence >= 20) {
    return {
      level:      "HIGH",
      label:      "HIGH",
      emoji:      "🔴",
      badgeClass: "bg-red-600 text-white",
    };
  } else if (confidence >= 15) {
    return {
      level:      "MEDIUM",
      label:      "MEDIUM",
      emoji:      "🟡",
      badgeClass: "bg-amber-500 text-white",
    };
  } else {
    return {
      level:      "LOW",
      label:      "LOW",
      emoji:      "⚪",
      badgeClass: "bg-slate-500 text-white",
    };
  }
}
