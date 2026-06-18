import type { PredictionClass } from "@/types";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { CLASS_SEVERITY } from "@/utils/classSeverity";

interface Props {
  classes: PredictionClass[];
}

export function ProbabilityBreakdown({ classes }: Props) {
  // Sort classes by confidence just in case they aren't sorted
  const sorted = [...classes].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="clinical-card p-5 space-y-4">
      <h3 className="font-sora font-semibold text-sm text-text-primary">
        Full AI Probability Analysis
      </h3>

      <div className="space-y-1">
        {sorted.map((item, index) => {
          const rank = item.rank || index + 1;
          const sev = CLASS_SEVERITY[item.label] ?? "Mild";

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle/70 last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-text-tertiary text-sm w-6 shrink-0">
                  #{rank}
                </span>
                <span className="text-text-primary text-sm truncate">
                  {item.label}
                </span>
              </div>
              <SeverityBadge severity={sev} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
