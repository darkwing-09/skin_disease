import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-border-subtle rounded-card"
    >
      <div className="text-text-tertiary mb-4">{icon}</div>
      <h3 className="font-sora font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-text-secondary text-sm max-w-sm mb-6">{description}</p>
      {action}
    </motion.div>
  );
}
