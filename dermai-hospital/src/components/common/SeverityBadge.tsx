import { motion } from "framer-motion";
import { SEVERITY_STYLES } from "@/lib/constants";

export function SeverityBadge({ severity }: { severity: string }) {
  const displaySeverity =
    severity === "High" ? "Severe" : severity === "Low" ? "Mild" : severity;
  const style = SEVERITY_STYLES[displaySeverity] ?? SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Low;

  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${style.bg} ${style.text} ${style.border} ${
        style.pulse ? "animate-criticalPulse" : ""
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${style.text.replace(
          "text-",
          "bg-"
        )}`}
        aria-hidden="true"
      />
      {displaySeverity}
    </motion.span>
  );
}
