import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B1120",
        surface: "#121A2C",
        "surface-hover": "#16213A",
        "border-subtle": "#1F2A44",
        "border-strong": "#2C3B5C",
        primary: {
          DEFAULT: "#0EA5E9",
          soft: "rgba(14,165,233,0.12)",
        },
        success: "#10B981",
        warning: "#F59E0B",
        "danger-high": "#F97316",
        "danger-critical": "#DC2626",
        text: {
          primary: "#E8EDF7",
          secondary: "#94A3B8",
          tertiary: "#5B6B8C",
        },
      },
      fontFamily: {
        sora: ["Sora", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        card: "10px",
        modal: "14px",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        criticalPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(220,38,38,0)" },
        },
        dotPulse: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.5" },
        },
        dash: {
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite linear",
        criticalPulse: "criticalPulse 2s infinite",
        dotPulse: "dotPulse 4s infinite ease-in-out",
        dash: "dash 1.5s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
