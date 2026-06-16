import { useParams, Link } from "react-router-dom";
import { usePrediction } from "@/hooks/usePrediction";
import { ScanResultPanel } from "@/components/scan/ScanResultPanel";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { CopyableId } from "@/components/common/CopyableId";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { ArrowLeft, User, Calendar, ShieldAlert, Cpu } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function ScanResultPage() {
  const { imageId } = useParams<{ imageId: string }>();
  const { data: result, isLoading, error } = usePrediction(imageId || "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ShimmerSkeleton className="h-6 w-48" />
        <div className="clinical-card p-6 space-y-4">
          <ShimmerSkeleton className="h-10 w-full" />
          <ShimmerSkeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="clinical-card p-8 text-center max-w-md mx-auto mt-12 space-y-4">
        <ShieldAlert className="text-danger-critical mx-auto" size={48} />
        <h3 className="font-sora font-semibold text-text-primary">
          Scan Report Not Found
        </h3>
        <p className="text-sm text-text-secondary">
          The requested scan assessment does not exist or you do not have permission to view it.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Patients", to: "/patients" },
          {
            label: result.patient.full_name,
            to: `/patients/${result.patient.patient_id}`,
          },
          { label: `Scan ${result.image_id.slice(0, 8)}` },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Link to="/patients" className="hover:text-primary transition-colors">
              Patient Registry
            </Link>
            <span>/</span>
            <span className="font-mono">{result.patient.patient_id}</span>
          </div>
          <h1 className="text-2xl font-sora font-bold mt-1">
            Clinical Assessment Report
          </h1>
        </div>

        <Link
          to={`/patients/${result.patient.patient_id}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-border-subtle hover:bg-surface-hover rounded text-sm font-medium text-text-secondary hover:text-text-primary transition-colors self-start sm:self-auto min-h-[40px]"
        >
          <User size={14} /> Patient Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Result Details */}
        <div className="lg:col-span-8 space-y-6">
          <ScanResultPanel result={result} initialFeedbackSubmitted={false} />
        </div>

        {/* Right Column: Meta Info Card & Notes */}
        <div className="lg:col-span-4 space-y-6">
          {/* Patient Details Card */}
          <ScrollReveal delay={0.05}>
            <div className="clinical-card p-5 space-y-4">
              <h3 className="font-sora font-semibold text-sm text-text-primary">
                Patient Demographics
              </h3>

              <div className="space-y-3.5 divide-y divide-border-subtle/40">
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-text-secondary">Name</span>
                  <span className="font-semibold text-text-primary">
                    {result.patient.full_name}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-text-secondary">Patient ID</span>
                  <CopyableId value={result.patient.patient_id} label="Patient ID" />
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-text-secondary">DOB</span>
                  <span className="text-text-primary font-medium">
                    {result.patient.date_of_birth !== "N/A"
                      ? formatDate(result.patient.date_of_birth)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-text-secondary">Gender / Blood Group</span>
                  <span className="text-text-primary font-medium">
                    {result.patient.gender} / {result.patient.blood_group || "—"}
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Assessment Meta Card */}
          <ScrollReveal delay={0.1}>
            <div className="clinical-card p-5 space-y-4">
              <h3 className="font-sora font-semibold text-sm text-text-primary">
                Assessment Metadata
              </h3>

              <div className="space-y-3.5 divide-y divide-border-subtle/40">
                <div className="flex justify-between items-center text-sm pt-2">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <Calendar size={14} />
                    <span>Analyzed At</span>
                  </div>
                  <span className="text-text-primary font-mono text-xs">
                    {formatDateTime(result.submitted_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <Cpu size={14} />
                    <span>AI Model</span>
                  </div>
                  <span className="text-text-primary font-mono text-xs">
                    {result.model_version}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-text-secondary">Image ID</span>
                  <CopyableId value={result.image_id} label="Image ID" />
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Notes Card */}
          {result.doctor_notes && (
            <ScrollReveal delay={0.15}>
              <div className="clinical-card p-5 space-y-3">
                <h3 className="font-sora font-semibold text-sm text-text-primary">
                  Clinical Observations
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed bg-base/35 p-3.5 rounded border border-border-subtle/50 whitespace-pre-wrap">
                  {result.doctor_notes}
                </p>
              </div>
            </ScrollReveal>
          )}

          {/* Disclaimer */}
          <ScrollReveal delay={0.2}>
            <p className="text-[10px] text-text-tertiary leading-normal bg-base/20 p-3.5 rounded border border-border-subtle/40">
              {result.disclaimer}
            </p>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
