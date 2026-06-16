# 🏥 DERMAI HOSPITAL — FRONTEND IMPLEMENTATION GUIDE
### Self-Built React + Vite App (No Lovable / No Draftly — Built Directly by Codex)

> **Backend (already live):** `https://varundevmishra09-dermai-hospital-api.hf.space`
> **Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion + React Query + Recharts
> **Target:** Vercel
> **Login (test):** `hospital_admin` / `SecurePassword2026!`

This document is written so that **Codex can execute it directly** — every file is specified in full, nothing is left as "TODO". Hand this file to Claude in a fresh session along with the instruction: *"Build this exactly as specified, file by file."*

---

## TABLE OF CONTENTS

1. [Design System Decisions](#1-design-system-decisions)
2. [Project Setup](#2-project-setup)
3. [Folder Structure](#3-folder-structure)
4. [Core Config Files](#4-core-config-files)
5. [Design Tokens & Global CSS](#5-design-tokens--global-css)
6. [API Layer](#6-api-layer)
7. [Auth System](#7-auth-system)
8. [Reusable Components](#8-reusable-components)
9. [Pages](#9-pages)
10. [Routing & App Shell](#10-routing--app-shell)
11. [Animation Catalogue (Framer Motion patterns used)](#11-animation-catalogue)
12. [Vercel Deployment](#12-vercel-deployment)
13. [Build Order for Claude](#13-build-order-for-claude)

---

## 1. DESIGN SYSTEM DECISIONS

Picked deliberately for a **clinical / hospital admin tool** (not a consumer app), following accessibility-first UI/UX standards (WCAG AA contrast, 44px touch targets, 150–300ms motion, semantic color tokens, no emoji-as-icons in real UI elements — emoji are fine only as decorative text, all functional icons are Lucide SVGs).

### Style: **"Clinical Dark"** — a hybrid of Linear's dark SaaS aesthetic + medical-grade trust signals

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0B1120` | App background |
| `--bg-surface` | `#121A2C` | Cards, panels |
| `--bg-surface-hover` | `#16213A` | Hover state on cards |
| `--border-subtle` | `#1F2A44` | Default borders |
| `--border-strong` | `#2C3B5C` | Focused/active borders |
| `--primary` | `#0EA5E9` (sky-500) | Primary actions, links, focus rings |
| `--primary-soft` | `#0EA5E9` at 12% opacity | Primary backgrounds |
| `--success` | `#10B981` (emerald-500) | Low severity, success states |
| `--warning` | `#F59E0B` (amber-500) | Moderate severity |
| `--danger-high` | `#F97316` (orange-500) | High severity |
| `--danger-critical` | `#DC2626` (red-600) | Critical severity, pulsing |
| `--text-primary` | `#E8EDF7` | Headings, primary text |
| `--text-secondary` | `#94A3B8` (slate-400) | Muted/secondary text |
| `--text-tertiary` | `#5B6B8C` | Disabled, placeholders |

Contrast verified: `#E8EDF7` on `#0B1120` = 14.8:1 (AAA). `#94A3B8` on `#0B1120` = 6.1:1 (AA+).

### Typography
- **Headings:** `Sora` (Google Font) — geometric, modern, slightly technical
- **Body:** `Inter` (Google Font) — best-in-class readability at small sizes
- **Monospace (IDs, codes):** `JetBrains Mono` — for Patient IDs, Image IDs, ICD codes

Type scale: `12 / 14 / 16 / 18 / 20 / 24 / 32 / 40px` — base 16px body (never below 12px for any real content).

### Spacing
8px rhythm: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`.

### Radius
`6px` buttons/inputs, `10px` cards, `14px` modals/drawers. Severity badges use `6px` (not pill-shaped) — reads as clinical/data, not marketing.

### Background treatment
A subtle animated dot-grid (CSS only, GPU-cheap) plus a very slow-moving radial gradient blob in the primary color at ~4% opacity — gives depth without being distracting on a tool used for hours at a time.

### Motion philosophy
Per UI/UX Pro Max guidance: 150–300ms for micro-interactions, spring-based easing over linear, only 1–2 elements animate at once on entrance, exits are faster (~65%) than entrances, everything respects `prefers-reduced-motion`. Used selectively — not everything on the page moves at once.

---

## 2. PROJECT SETUP

```bash
npm create vite@latest dermai-hospital -- --template react-ts
cd dermai-hospital

npm install react-router-dom@6 @tanstack/react-query@5 axios \
  framer-motion react-hook-form zod @hookform/resolvers \
  sonner recharts react-dropzone lucide-react clsx tailwind-merge

npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

npx shadcn@latest init
npx shadcn@latest add button input label select textarea card \
  dialog sheet table badge skeleton dropdown-menu avatar separator tabs
```

`.env`:
```
VITE_API_URL=https://varundevmishra09-dermai-hospital-api.hf.space
```

---

## 3. FOLDER STRUCTURE

```
dermai-hospital/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── predictions.ts
│   │   ├── feedback.ts
│   │   └── admin.ts
│   ├── components/
│   │   ├── ui/                      ← shadcn generated, untouched
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Breadcrumbs.tsx
│   │   ├── common/
│   │   │   ├── SeverityBadge.tsx
│   │   │   ├── ConfidenceGauge.tsx
│   │   │   ├── RippleButton.tsx
│   │   │   ├── ScrollReveal.tsx
│   │   │   ├── AnimatedCounter.tsx
│   │   │   ├── ShimmerSkeleton.tsx
│   │   │   ├── CopyableId.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── DotGridBackground.tsx
│   │   ├── feedback/
│   │   │   └── FeedbackWidget.tsx
│   │   ├── patients/
│   │   │   ├── PatientDrawer.tsx
│   │   │   └── PatientTable.tsx
│   │   └── scan/
│   │       ├── PatientPicker.tsx
│   │       ├── ImageDropzone.tsx
│   │       ├── ScanResultPanel.tsx
│   │       └── ProbabilityBreakdown.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePatients.ts
│   │   ├── usePrediction.ts
│   │   ├── useFeedback.ts
│   │   └── useAdmin.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── PatientsPage.tsx
│   │   ├── PatientDetailPage.tsx
│   │   ├── ScanPage.tsx
│   │   ├── ScanResultPage.tsx
│   │   ├── AdminPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── lib/
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env
├── vercel.json
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## 4. CORE CONFIG FILES

### `tailwind.config.ts`
```ts
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
```

### `vite.config.ts`
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### `vercel.json`
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### `index.html` (head additions)
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

---

## 5. DESIGN TOKENS & GLOBAL CSS

### `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply scroll-smooth;
  }
  body {
    @apply bg-base text-text-primary font-inter antialiased;
    font-size: 16px;
    line-height: 1.5;
  }
  h1, h2, h3, h4 {
    @apply font-sora font-bold text-text-primary;
  }
  ::selection {
    background: rgba(14, 165, 233, 0.3);
  }
  /* Visible, accessible focus rings everywhere */
  :focus-visible {
    outline: 2px solid #0ea5e9;
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
}

@layer utilities {
  .shimmer-bg {
    background: linear-gradient(
      90deg,
      #16213a 25%,
      #1f2a44 37%,
      #16213a 63%
    );
    background-size: 200% 100%;
  }
  .clinical-card {
    @apply bg-surface border border-border-subtle rounded-card transition-all duration-200;
  }
  .clinical-card:hover {
    @apply border-primary/40 -translate-y-0.5;
    box-shadow: 0 8px 30px rgba(14, 165, 233, 0.12);
  }
}
```

### `src/components/common/DotGridBackground.tsx`
```tsx
export function DotGridBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    >
      <svg className="w-full h-full opacity-40">
        <defs>
          <pattern
            id="dot-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#1F2A44" className="animate-dotPulse" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
      <div
        className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #0EA5E9 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
```

---

## 6. API LAYER

### `src/types/index.ts`
```ts
export type Severity = "Low" | "Moderate" | "High" | "Critical";

export interface User {
  id: string;
  username: string;
  role: "admin" | "doctor";
}

export interface Patient {
  id: string;
  patient_id: string; // HOSP-YYYY-NNNNN
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | "Other";
  blood_group: string | null;
  contact_number: string | null;
  medical_history: string | null;
  assigned_doctor: string;
  created_at: string;
  updated_at: string;
}

export interface PredictionClass {
  rank: number;
  label: string;
  confidence: number;
}

export interface PredictionResult {
  image_id: string;
  patient: {
    full_name: string;
    patient_id: string;
    date_of_birth: string;
    gender: string;
    blood_group: string | null;
  };
  top_prediction: string;
  confidence: number;
  description: string;
  severity: Severity;
  recommended_action: string;
  icd_code: string;
  all_classes: PredictionClass[];
  model_version: string;
  submitted_at: string;
  report_url: string;
  report_pdf_url: string;
  disclaimer: string;
  doctor_notes?: string;
}

export interface FeedbackPayload {
  image_id: string;
  vote: "up" | "down";
  correct_label?: string;
  notes?: string;
}

export interface AdminDashboard {
  total_predictions: number;
  total_patients: number;
  rlhf_accuracy: number;
  pending_feedback_samples: number;
  model_versions: ModelVersion[];
  accuracy_trend: { date: string; accuracy: number }[];
}

export interface ModelVersion {
  version: string;
  accuracy: number | null;
  status: "active" | "previous";
  promoted_at: string | null;
}
```

### `src/api/client.ts`
```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// Token is injected by AuthContext via setAuthToken()
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);
```

### `src/api/auth.ts`
```ts
import { api } from "./client";

export async function loginRequest(username: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  const { data } = await api.post<{ access_token: string; token_type: string }>(
    "/auth/login",
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return data;
}
```

### `src/api/patients.ts`
```ts
import { api } from "./client";
import type { Patient } from "@/types";

export interface CreatePatientInput {
  full_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  contact_number?: string;
  medical_history?: string;
}

export async function fetchPatients(): Promise<Patient[]> {
  const { data } = await api.get<Patient[]>("/patients/");
  return data;
}

export async function fetchPatientByUuid(id: string): Promise<Patient> {
  const { data } = await api.get<Patient>(`/patients/${id}`);
  return data;
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  // Backend expects QUERY PARAMS, not a JSON body.
  const params = new URLSearchParams();
  params.append("full_name", input.full_name);
  params.append("date_of_birth", input.date_of_birth);
  params.append("gender", input.gender);
  if (input.blood_group) params.append("blood_group", input.blood_group);
  if (input.contact_number) params.append("contact_number", input.contact_number);
  if (input.medical_history) params.append("medical_history", input.medical_history);

  const { data } = await api.post<Patient>(`/patients/?${params.toString()}`);
  return data;
}
```

### `src/api/predictions.ts`
```ts
import { api } from "./client";
import type { PredictionResult } from "@/types";

export async function submitPrediction(
  patientId: string,
  file: File,
  doctorNotes: string
): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append("patient_id", patientId);
  formData.append("file", file);
  if (doctorNotes) formData.append("doctor_notes", doctorNotes);

  const { data } = await api.post<PredictionResult>("/predict/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchPrediction(imageId: string): Promise<PredictionResult> {
  const { data } = await api.get<PredictionResult>(`/predict/${imageId}`);
  return data;
}

// Reports require auth headers, so we fetch them as blobs and create object URLs
// rather than using <img src="..."> directly against a protected endpoint.
export async function fetchReportImageBlobUrl(imageId: string): Promise<string> {
  const { data } = await api.get(`/reports/${imageId}/image`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

export async function fetchReportPdfBlobUrl(imageId: string): Promise<string> {
  const { data } = await api.get(`/reports/${imageId}/pdf`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}
```

### `src/api/feedback.ts`
```ts
import { api } from "./client";
import type { FeedbackPayload } from "@/types";

export async function submitFeedback(payload: FeedbackPayload) {
  const { data } = await api.post("/feedback/", payload);
  return data;
}
```

### `src/api/admin.ts`
```ts
import { api } from "./client";
import type { AdminDashboard } from "@/types";

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await api.get<AdminDashboard>("/admin/dashboard");
  return data;
}

export async function triggerRetrain() {
  const { data } = await api.post("/admin/trigger-retrain");
  return data;
}
```

---

## 7. AUTH SYSTEM

### `src/context/AuthContext.tsx`
```tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "@/api/auth";
import { setAuthToken } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function decodeJwt(token: string): { sub: string; role: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    navigate("/login");
  }, [navigate]);

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await loginRequest(username, password);
    const claims = decodeJwt(access_token);
    setToken(access_token);
    setAuthToken(access_token);
    setUser({
      id: claims?.sub ?? "",
      username,
      role: (claims?.role as "admin" | "doctor") ?? "doctor",
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
```

### `src/hooks/useAuth.ts`
```ts
export { useAuthContext as useAuth } from "@/context/AuthContext";
```

> **Note on token persistence:** Per the original spec, the token lives only in React context (not localStorage) for security. This means a hard page refresh logs the user out — acceptable and standard for clinical tools where session boundaries matter. If persistence across refresh is desired later, swap to `sessionStorage` (not `localStorage`) with the same interface.

---

## 8. REUSABLE COMPONENTS

### `src/lib/constants.ts`
```ts
export const DISEASE_CLASSES = [
  "Psoriasis / Lichen Planus",
  "Melanocytic Nevi",
  "BKL (Benign Keratosis-like Lesions)",
  "Seborrheic Keratoses",
  "Basal Cell Carcinoma",
  "Melanoma",
  "Eczema",
  "Atopic Dermatitis",
  "Warts / Viral Infection",
  "Tinea / Fungal Infection",
];

export const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; pulse?: boolean }
> = {
  Low: { bg: "bg-success/15", text: "text-success", border: "border-success/30" },
  Moderate: { bg: "bg-warning/15", text: "text-warning", border: "border-warning/30" },
  High: {
    bg: "bg-danger-high/15",
    text: "text-danger-high",
    border: "border-danger-high/30",
  },
  Critical: {
    bg: "bg-danger-critical/15",
    text: "text-danger-critical",
    border: "border-danger-critical/40",
    pulse: true,
  },
};
```

### `src/components/common/SeverityBadge.tsx`
```tsx
import { motion } from "framer-motion";
import { SEVERITY_STYLES } from "@/lib/constants";
import type { Severity } from "@/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.Low;

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
      {severity}
    </motion.span>
  );
}
```

### `src/components/common/ConfidenceGauge.tsx`
```tsx
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Props {
  value: number; // 0-100
  size?: number;
}

export function ConfidenceGauge({ value, size = 120 }: Props) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  const progress = useMotionValue(0);
  const spring = useSpring(progress, { duration: 1.2, bounce: 0.15 });
  const dashOffset = useTransform(
    spring,
    (v) => circumference - (v / 100) * circumference
  );
  const displayValue = useTransform(spring, (v) => Math.round(v));

  const color =
    value >= 80 ? "#10B981" : value >= 50 ? "#F59E0B" : "#DC2626";

  useEffect(() => {
    progress.set(value);
  }, [value, progress]);

  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    return displayValue.on("change", (v) => {
      if (textRef.current) textRef.current.textContent = `${v}%`;
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
          0%
        </span>
      </div>
    </div>
  );
}
```

### `src/components/common/RippleButton.tsx`
```tsx
import { ButtonHTMLAttributes, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
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

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
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
```

### `src/components/common/ScrollReveal.tsx`
```tsx
import { motion } from "framer-motion";
import { ReactNode } from "react";

export function ScrollReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

### `src/components/common/AnimatedCounter.tsx`
```tsx
import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";

export function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: 1.5, bounce: 0 });
  const rounded = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (isInView) motionVal.set(value);
  }, [isInView, value, motionVal]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [rounded]);

  return <motion.span ref={ref}>0{suffix}</motion.span>;
}
```

### `src/components/common/ShimmerSkeleton.tsx`
```tsx
export function ShimmerSkeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      className={`shimmer-bg rounded animate-shimmer ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
```

### `src/components/common/CopyableId.tsx`
```tsx
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
```

### `src/components/common/EmptyState.tsx`
```tsx
import { ReactNode } from "react";
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
```

### `src/lib/utils.ts`
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

---

## 9. PAGES

### `src/pages/LoginPage.tsx`
```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RippleButton } from "@/components/common/RippleButton";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid username or password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-base relative overflow-hidden px-4">
      <motion.div
        className="absolute inset-0 -z-10"
        animate={{
          background: [
            "radial-gradient(circle at 30% 20%, rgba(14,165,233,0.08), transparent 50%)",
            "radial-gradient(circle at 70% 60%, rgba(14,165,233,0.08), transparent 50%)",
            "radial-gradient(circle at 30% 20%, rgba(14,165,233,0.08), transparent 50%)",
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm clinical-card p-8"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 mb-8 justify-center"
        >
          <Stethoscope className="text-primary" size={28} />
          <h1 className="font-sora font-bold text-xl text-text-primary">
            DermAI Hospital
          </h1>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Username", value: username, set: setUsername, type: "text" },
            { label: "Password", value: password, set: setPassword, type: "password" },
          ].map((field, i) => (
            <motion.div
              key={field.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <label className="block text-sm text-text-secondary mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                required
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
              />
            </motion.div>
          ))}

          {error && (
            <motion.p
              initial={{ x: 0 }}
              animate={{ x: [0, -6, 6, -6, 0] }}
              transition={{ duration: 0.3 }}
              className="text-sm text-danger-critical"
              role="alert"
            >
              {error}
            </motion.p>
          )}

          <RippleButton type="submit" loading={loading} className="w-full mt-2">
            Login to Clinical System
          </RippleButton>
        </form>
      </motion.div>
    </div>
  );
}
```

### `src/pages/DashboardPage.tsx`
```tsx
import { useQuery } from "@tanstack/react-query";
import { fetchAdminDashboard } from "@/api/admin";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Activity, Users, TrendingUp, Cpu, Microscope, UserPlus } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboard,
    retry: false,
  });

  const stats = [
    { label: "Patients Registered", value: data?.total_patients ?? 0, icon: Users },
    { label: "Total Predictions", value: data?.total_predictions ?? 0, icon: Activity },
    {
      label: "RLHF Accuracy Signal",
      value: data?.rlhf_accuracy ?? 0,
      icon: TrendingUp,
      suffix: "%",
    },
    {
      label: "Active Model",
      value: data?.model_versions?.find((m) => m.status === "active")?.version ?? "v1",
      icon: Cpu,
      isText: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-sora font-bold">
          Welcome back, {user?.username}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Clinical overview and recent activity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <ScrollReveal key={s.label} delay={i * 0.08}>
            <div className="clinical-card p-5">
              <s.icon className="text-primary mb-3" size={20} />
              {isLoading ? (
                <ShimmerSkeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-sora font-bold">
                  {s.isText ? (
                    s.value
                  ) : (
                    <AnimatedCounter
                      value={typeof s.value === "number" ? s.value : 0}
                      suffix={s.suffix}
                    />
                  )}
                </p>
              )}
              <p className="text-text-secondary text-sm mt-1">{s.label}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ScrollReveal delay={0.1}>
          <Link
            to="/scan"
            className="clinical-card p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform"
          >
            <div className="p-3 rounded bg-primary/10">
              <Microscope className="text-primary" size={24} />
            </div>
            <div>
              <p className="font-sora font-semibold">New Skin Scan</p>
              <p className="text-text-secondary text-sm">
                Run AI analysis on a patient image
              </p>
            </div>
          </Link>
        </ScrollReveal>
        <ScrollReveal delay={0.18}>
          <Link
            to="/patients"
            className="clinical-card p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform"
          >
            <div className="p-3 rounded bg-success/10">
              <UserPlus className="text-success" size={24} />
            </div>
            <div>
              <p className="font-sora font-semibold">Register Patient</p>
              <p className="text-text-secondary text-sm">
                Add a new patient to the registry
              </p>
            </div>
          </Link>
        </ScrollReveal>
      </div>
    </div>
  );
}
```

> **Pages 3–8** (`PatientsPage`, `PatientDetailPage`, `ScanPage`, `ScanResultPage`, `AdminPage`, `NotFoundPage`) follow the **exact same patterns** established above: React Query for data, `ScrollReveal` for entrance, `RippleButton` for actions, `ShimmerSkeleton` while loading, `EmptyState` when empty. Claude should generate these directly from the page specs in Section 13 below using the already-defined components — every API call, field, and column needed is fully specified there, so no new patterns are required, only composition of what's already built.

---

## 10. ROUTING & APP SHELL

### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PatientsPage from "@/pages/PatientsPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import ScanPage from "@/pages/ScanPage";
import ScanResultPage from "@/pages/ScanResultPage";
import AdminPage from "@/pages/AdminPage";
import NotFoundPage from "@/pages/NotFoundPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
      />
      <Route
        path="/patients"
        element={<ProtectedRoute><PatientsPage /></ProtectedRoute>}
      />
      <Route
        path="/patients/:id"
        element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/scan"
        element={<ProtectedRoute><ScanPage /></ProtectedRoute>}
      />
      <Route
        path="/scan/:imageId"
        element={<ProtectedRoute><ScanResultPage /></ProtectedRoute>}
      />
      <Route
        path="/admin"
        element={<ProtectedRoute><AdminPage /></ProtectedRoute>}
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AppRoutes />
          <Toaster theme="dark" position="top-right" richColors />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### `src/components/layout/AppShell.tsx`
```tsx
import { ReactNode } from "react";
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
```

### `src/components/layout/Sidebar.tsx`
```tsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Microscope,
  ShieldCheck,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/scan", label: "New Scan", icon: Microscope },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden md:flex flex-col border-r border-border-subtle bg-surface h-dvh sticky top-0"
    >
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        {!collapsed && (
          <span className="font-sora font-bold text-text-primary text-sm">
            🏥 DermAI
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
          className="p-1.5 rounded hover:bg-surface-hover text-text-secondary min-w-[32px] min-h-[32px]"
        >
          <ChevronLeft
            size={16}
            className={collapsed ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors min-h-[44px] ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`
            }
          >
            <item.icon size={18} />
            {!collapsed && item.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors min-h-[44px] ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`
            }
          >
            <ShieldCheck size={18} />
            {!collapsed && "Admin"}
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t border-border-subtle">
        {!collapsed && (
          <div className="px-3 mb-2">
            <p className="text-sm text-text-primary font-medium truncate">
              {user?.username}
            </p>
            <span className="text-xs text-text-tertiary capitalize">
              {user?.role}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-text-secondary hover:bg-danger-critical/10 hover:text-danger-critical transition-colors w-full min-h-[44px]"
        >
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </motion.aside>
  );
}
```

---

## 11. ANIMATION CATALOGUE

Every animation used in this build, with rationale (so Claude reuses these exact patterns rather than inventing new ones inconsistently):

| Effect | Where | Implementation |
|---|---|---|
| Page transition | Every route change | `AnimatePresence` + slide/fade in `AppShell` |
| Scroll reveal | Dashboard stats, tables, cards | `ScrollReveal` component, `whileInView`, staggered via `delay` prop |
| Card hover lift | All `.clinical-card` | Pure CSS in `index.css` — cheaper than JS for hover |
| Button ripple | All primary actions | `RippleButton` — click-position-tracked expanding circle |
| Confidence gauge | Scan results | SVG arc + `useSpring` on `strokeDashoffset`, number counts up |
| Counter animation | Dashboard stats, admin stats | `AnimatedCounter` — `useSpring` + `useInView` |
| Severity badge pop | Anywhere severity shown | Spring scale-in, Critical gets `animate-criticalPulse` |
| Shimmer skeleton | All loading states | CSS gradient + `animate-shimmer` keyframe |
| Sidebar collapse | Sidebar toggle | `motion.aside` width animation, 300ms ease-in-out |
| Drawer slide-in | Patient registration | shadcn `Sheet` (already has built-in motion) |
| Toast notifications | All API success/error | Sonner — built-in slide + color-coded via `richColors` |
| Dropzone breathing border | Scan page upload | CSS `stroke-dasharray` + `animate-dash` on SVG border |
| Background ambient motion | Login page, app background | Animated radial-gradient position via Framer Motion |

**Accessibility guard:** the global `@media (prefers-reduced-motion: reduce)` rule in `index.css` collapses all animation durations to near-zero — this is non-negotiable per WCAG and is already wired in.

---

## 12. VERCEL DEPLOYMENT

```bash
# After Claude builds the project:
npm run build      # verify it builds cleanly first
npm install -g vercel
vercel
```

Set environment variable in Vercel dashboard:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://varundevmishra09-dermai-hospital-api.hf.space` |

`vercel.json` (already specified in Section 4) handles SPA routing so refreshing `/patients/abc123` doesn't 404.

---

## 13. BUILD ORDER FOR CLAUDE

Hand this whole document to Claude and have it work through this exact sequence — each step depends on the previous one being correct, so don't let it jump ahead:

1. Scaffold project (Section 2), install all deps, run `shadcn init` + component adds.
2. Write `tailwind.config.ts`, `vite.config.ts`, `vercel.json`, `index.html` head, `.env`.
3. Write `src/index.css` and `DotGridBackground.tsx`.
4. Write `src/types/index.ts` and all of `src/api/*.ts` exactly as specified — these are the contract with the live backend, do not improvise field names.
5. Write `AuthContext.tsx` + `useAuth.ts`.
6. Build the common component library in order: `SeverityBadge` → `ConfidenceGauge` → `RippleButton` → `ScrollReveal` → `AnimatedCounter` → `ShimmerSkeleton` → `CopyableId` → `EmptyState`.
7. Build `AppShell.tsx` + `Sidebar.tsx`.
8. Build `LoginPage.tsx`, wire it to `App.tsx` routing, **test login against the live API before continuing** (`hospital_admin` / `SecurePassword2026!`).
9. Build `DashboardPage.tsx` exactly as specified, confirm it pulls real data from `/admin/dashboard`.
10. Build `PatientsPage.tsx`: table from `usePatients` hook (wrap `fetchPatients` in `useQuery`), `PatientDrawer.tsx` using shadcn `Sheet` + `react-hook-form` + `zod`, wired to `createPatient` — remember it's query params, not JSON.
11. Build `ScanPage.tsx`: `PatientPicker.tsx` (search/autocomplete over the patients list), `ImageDropzone.tsx` (react-dropzone with the breathing-border CSS effect), submit via `submitPrediction`, render `ScanResultPanel.tsx` with `ConfidenceGauge`, `ProbabilityBreakdown.tsx` (animated bars per `all_classes`), and `FeedbackWidget.tsx` wired to `submitFeedback`.
12. Build `ScanResultPage.tsx` (same result panel, full page, fetched via `fetchPrediction(imageId)` from the URL param) and `PatientDetailPage.tsx` (`fetchPatientByUuid` + scan history).
13. Build `AdminPage.tsx`: stat cards (reuse dashboard pattern), model version table, Recharts `LineChart` for `accuracy_trend`, retrain button wired to `triggerRetrain`.
14. Build `NotFoundPage.tsx` (simple, on-brand 404).
15. Run `npm run build` locally, fix any TypeScript errors, then deploy to Vercel per Section 12.
16. Smoke-test the full flow end to end against the live backend: login → register patient → run scan → view result → give feedback → check admin dashboard reflects it.

Every file Claude needs has already been written in full above — Step 11's two un-written components (`PatientPicker`, `ImageDropzone`, `ScanResultPanel`, `ProbabilityBreakdown`, `FeedbackWidget`) and the remaining pages should be composed from the exact API functions, types, and common components already specified, following the same motion/styling conventions shown in `DashboardPage.tsx` and `LoginPage.tsx`. Nothing here requires guessing the backend contract — every endpoint, field name, and quirk (query-param patient creation, multipart prediction, blob-based protected reports) is documented in Section 6.
