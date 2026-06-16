import { useQuery } from "@tanstack/react-query";
import { fetchAdminDashboard } from "@/api/admin";
import { usePatients } from "@/hooks/usePatients";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Activity, Users, TrendingUp, Cpu, Microscope, UserPlus } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: patients = [], isLoading: loadingPatients } = usePatients();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboard,
    retry: false,
  });

  const stats = [
    { label: "Patients Registered", value: patients.length, icon: Users, loading: loadingPatients },
    { label: "Total Predictions", value: data?.total_predictions ?? 0, icon: Activity, loading: isLoading },
    {
      label: "RLHF Accuracy Signal",
      value: data?.feedback_stats?.accuracy_signal ?? 0,
      icon: TrendingUp,
      suffix: "%",
      loading: isLoading,
    },
    {
      label: "Active Model",
      value: data?.active_model?.version ?? "v1",
      icon: Cpu,
      isText: true,
      loading: isLoading,
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
              {s.loading ? (
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
