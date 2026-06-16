import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { motion } from "framer-motion";

export function CopyableId({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy ${label ?? "ID"} ${value}`}
      className="inline-flex items-center gap-1.5 font-mono text-sm text-text-secondary hover:text-text-primary transition-colors group min-h-[32px]"
    >
      <span>{value}</span>
      <motion.span
        animate={{ scale: copied ? 1.2 : 1 }}
        transition={{ duration: 0.15 }}
        className="text-text-tertiary group-hover:text-primary"
      >
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </motion.span>
    </button>
  );
}
