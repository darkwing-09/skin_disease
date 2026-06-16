import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { formatPercentValue, normalizePercent } from "@/lib/utils";

interface Props {
  value: number; // 0-100
  size?: number;
}

export function ConfidenceGauge({ value, size = 120 }: Props) {
  const percent = normalizePercent(value);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  const progress = useMotionValue(0);
  const spring = useSpring(progress, { duration: 1.2, bounce: 0.15 });
  const dashOffset = useTransform(
    spring,
    (v) => circumference - (v / 100) * circumference
  );
  const displayValue = useTransform(spring, (v) => v);

  const color =
    percent >= 80 ? "#10B981" : percent >= 50 ? "#F59E0B" : "#DC2626";

  useEffect(() => {
    progress.set(percent);
  }, [percent, progress]);

  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    return displayValue.on("change", (v) => {
      if (textRef.current) textRef.current.textContent = formatPercentValue(v);
    });
  }, [displayValue]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1F2A44"
          strokeWidth={8}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          ref={textRef}
          className="text-2xl font-sora font-bold text-text-primary"
        >
          {formatPercentValue(percent)}
        </span>
      </div>
    </div>
  );
}
