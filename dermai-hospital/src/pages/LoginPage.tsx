import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RippleButton } from "@/components/common/RippleButton";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      toast.success("Login successful.");
      navigate("/dashboard");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.status === 401
          ? "Invalid username or password."
          : "Login service is unavailable. Please try again in a moment.";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-base relative overflow-hidden px-4">
      <motion.div
        className="absolute inset-0 -z-10"
        animate={{
          background: [
            "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.08), transparent 50%)",
            "radial-gradient(circle at 70% 60%, hsl(var(--primary) / 0.08), transparent 50%)",
            "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.08), transparent 50%)",
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
