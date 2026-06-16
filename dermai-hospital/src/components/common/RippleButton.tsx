import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: ReactNode;
  variant?: "primary" | "danger" | "success" | "ghost";
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: "bg-primary text-white hover:brightness-110",
  danger: "bg-danger-critical text-white hover:brightness-110",
  success: "bg-success text-white hover:brightness-110",
  ghost: "bg-surface border border-border-subtle text-text-primary hover:bg-surface-hover",
};

export function RippleButton({
  children,
  variant = "primary",
  loading,
  className,
  onClick,
  disabled,
  ...rest
}: Props) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [
      ...r,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 500);
    onClick?.(e);
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        "relative overflow-hidden px-4 py-2.5 rounded font-medium text-sm transition-all duration-150 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ left: r.x, top: r.y }}
            className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full bg-white/40 pointer-events-none"
          />
        ))}
      </AnimatePresence>
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full"
          />
          Loading...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
