import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { DotGridBackground } from "@/components/common/DotGridBackground";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh bg-base">
      <DotGridBackground />
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <footer className="mt-16 pt-6 border-t border-border-subtle text-text-tertiary text-xs text-center">
          © 2026 DermAI Hospital · AI-Assisted Clinical Tool · Not a Substitute
          for Medical Advice
        </footer>
      </main>
    </div>
  );
}
