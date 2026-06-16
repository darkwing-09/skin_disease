import { motion } from "framer-motion";
import type { PredictionClass } from "@/types";
import { formatPercentValue, normalizePercent } from "@/lib/utils";

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

      <div className="space-y-3.5">
        {sorted.map((item, index) => {
          const rank = index + 1;
          const pct = normalizePercent(item.confidence);

          // Bar color logic: rank 1 = sky-500 (primary), rank 2 = violet (indigo-500), rest = slate/border-strong
          const barColor =
            rank === 1
              ? "bg-primary"
              : rank === 2
              ? "bg-indigo-500"
              : "bg-border-strong";

          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text-tertiary w-4">
                    #{rank}
                  </span>
                  <span className="font-medium text-text-primary">
                    {item.label}
                  </span>
                </div>
                <span className="font-mono font-semibold text-text-secondary">
                  {formatPercentValue(pct)}
                </span>
              </div>

              <div className="h-2 w-full bg-base rounded-full overflow-hidden border border-border-subtle/50">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.05 }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
