import { useState } from "react";
import {
  useAdminDashboard,
  useModelVersions,
  useTriggerRetrain,
  useAuditLogs,
} from "@/hooks/useAdmin";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RippleButton } from "@/components/common/RippleButton";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { CopyableId } from "@/components/common/CopyableId";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Cpu,
  Layers,
  Activity,
  Play,
  History,
  ShieldCheck,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function AdminPage() {
  const { data: dashboard, isLoading: loadingDash } = useAdminDashboard();
  const { data: versions = [], isLoading: loadingVersions } = useModelVersions();
  const { data: auditLogs = [], isLoading: loadingLogs } = useAuditLogs(50);
  const { mutate: triggerRetrain, isPending: retraining } = useTriggerRetrain();

  const [activeTab, setActiveTab] = useState<"versions" | "audit">("versions");

  // Recharts accuracy chart data mapped from actual versions database
  const chartData = [...versions]
    .reverse()
    .filter((v) => v.accuracy !== null)
    .map((v) => {
      const acc = v.accuracy || 0;
      return {
        name: v.version,
        Accuracy: acc <= 1 ? Math.round(acc * 1000) / 10 : acc,
      };
    });

  const stats = [
    {
      label: "Total AI Predictions",
      value: dashboard?.total_predictions ?? 0,
      icon: Activity,
    },
    {
      label: "User Feedback Count",
      value: dashboard?.total_feedback ?? 0,
      icon: History,
    },
    {
      label: "Pending Retrain Samples",
      value: dashboard?.feedback_stats?.pending_for_retrain ?? 0,
      icon: Layers,
    },
    {
      label: "RLHF Accuracy Signal",
      value: dashboard?.feedback_stats?.accuracy_signal
        ? `${dashboard.feedback_stats.accuracy_signal}%`
        : "N/A",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Admin Console" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-sora font-bold">Admin Console</h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage models, view training runs, and inspect security audit logs
          </p>
        </div>
        <RippleButton
          onClick={() => triggerRetrain()}
          loading={retraining}
          className="self-start sm:self-auto"
        >
          <Play size={14} className="mr-2 inline" />
          Queue Nightly Retrain
        </RippleButton>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <ScrollReveal key={s.label} delay={i * 0.05}>
            <div className="clinical-card p-5">
              <s.icon className="text-primary mb-3.5" size={20} />
              {loadingDash ? (
                <ShimmerSkeleton className="h-7 w-20" />
              ) : (
                <p className="text-2xl font-sora font-bold text-text-primary">
                  {s.value}
                </p>
              )}
              <p className="text-text-secondary text-xs mt-1.5 font-medium">
                {s.label}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Accuracy Trend Chart */}
      <ScrollReveal delay={0.25}>
        <div className="clinical-card p-6 space-y-4">
          <div>
            <h3 className="font-sora font-semibold text-text-primary">
              Model Accuracy Signal History
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Reflects performance metrics across successive nightly training runs
            </p>
          </div>

          <div className="h-64 w-full">
            {loadingVersions ? (
              <ShimmerSkeleton className="h-full w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-tertiary text-sm border border-dashed border-border-subtle/40 rounded">
                No accuracy metrics available. Run a retrain first.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "6px",
                      color: "#F8FAFC",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Accuracy"
                    stroke="#0EA5E9"
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* Tabs list */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          onClick={() => setActiveTab("versions")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
            activeTab === "versions"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Model Versions
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* Tabs Content */}
      <ScrollReveal delay={0.3}>
        {activeTab === "versions" ? (
          <div className="clinical-card overflow-x-auto">
            {loadingVersions ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ShimmerSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                No model versions recorded.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Version Tag</th>
                    <th className="text-left px-4 py-3 font-medium">Accuracy</th>
                    <th className="text-left px-4 py-3 font-medium">Training Samples</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Promoted At</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr
                      key={v.version}
                      className="border-b border-border-subtle/50 hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-text-primary font-semibold flex items-center gap-2">
                        <Cpu size={14} className="text-primary" />
                        {v.version}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono">
                        {v.accuracy
                          ? `${
                              v.accuracy <= 1
                                ? Math.round(v.accuracy * 1000) / 10
                                : v.accuracy
                            }%`
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {v.training_samples ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            v.status === "active"
                              ? "bg-success/15 text-success border border-success/30"
                              : "bg-text-secondary/15 text-text-secondary border border-text-secondary/30"
                          }`}
                        >
                          {v.status === "active" ? "Active" : "Previous"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {v.promoted_at ? formatDateTime(v.promoted_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="clinical-card overflow-x-auto">
            {loadingLogs ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ShimmerSkeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                No audit logs found.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium">User ID</th>
                    <th className="text-left px-4 py-3 font-medium">Action</th>
                    <th className="text-left px-4 py-3 font-medium">IP Address</th>
                    <th className="text-left px-4 py-3 font-medium">Payload Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border-subtle/50 hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {log.user_id ? (
                          <CopyableId value={log.user_id} label="User ID" />
                        ) : (
                          <span className="text-text-tertiary">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-1.5 text-text-primary">
                          <ShieldCheck size={12} className="text-success" />
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-xs truncate font-mono text-xs">
                        {JSON.stringify(log.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </ScrollReveal>
    </div>
  );
}
