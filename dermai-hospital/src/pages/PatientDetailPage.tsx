import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPatientByUuid } from "@/api/patients";
import { fetchPredictionsByPatient } from "@/api/predictions";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { RippleButton } from "@/components/common/RippleButton";
import { EmptyState } from "@/components/common/EmptyState";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import {
  User,
  Phone,
  FileText,
  Calendar,
  Microscope,
  Eye,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { formatConfidence, formatDate, formatDateTime } from "@/lib/utils";

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  // 1. Fetch patient details
  const {
    data: patient,
    isLoading: loadingPatient,
    error: patientError,
  } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => fetchPatientByUuid(patientId || ""),
    enabled: !!patientId,
  });

  const { data: scanHistory = [], isLoading: loadingScans } = useQuery({
    queryKey: ["patient-predictions", patientId],
    queryFn: () => fetchPredictionsByPatient(patientId || ""),
    enabled: !!patientId,
  });

  if (loadingPatient) {
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

  if (patientError || !patient) {
    return (
      <div className="clinical-card p-8 text-center max-w-md mx-auto mt-12 space-y-4">
        <ShieldAlert className="text-danger-critical mx-auto" size={48} />
        <h3 className="font-sora font-semibold text-text-primary">
          Patient Not Found
        </h3>
        <p className="text-sm text-text-secondary">
          The patient ID you requested does not exist or you do not have permission to view this file.
        </p>
        <Link
          to="/patients"
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
        >
          <ArrowLeft size={14} /> Back to Registry
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
          { label: patient.full_name },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-text-secondary text-sm font-mono">
            {patient.patient_id}
          </span>
          <h1 className="text-2xl font-sora font-bold mt-0.5">
            {patient.full_name}
          </h1>
        </div>

        <RippleButton onClick={() => navigate(`/scan?patient=${patient.patient_id}`)}>
          <Microscope size={16} className="mr-2 inline" />
          New Skin Scan
        </RippleButton>
      </div>

      {/* Patient Demographic Details Card */}
      <div className="clinical-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-sora font-semibold text-sm text-text-primary flex items-center gap-2">
            <User size={16} className="text-primary" />
            Demographics
          </h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              Gender:{" "}
              <span className="text-text-primary font-semibold">
                {patient.gender}
              </span>
            </p>
            <p>
              DOB:{" "}
              <span className="text-text-primary font-medium">
                {patient.date_of_birth ? formatDate(patient.date_of_birth) : "—"}
              </span>
            </p>
            <p>
              Blood Group:{" "}
              <span className="text-text-primary font-medium">
                {patient.blood_group || "Not specified"}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-sora font-semibold text-sm text-text-primary flex items-center gap-2">
            <Phone size={16} className="text-primary" />
            Contact Info
          </h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              Phone:{" "}
              <span className="text-text-primary font-medium">
                {patient.contact_number || "—"}
              </span>
            </p>
            <p>
              Registered:{" "}
              <span className="text-text-primary font-medium">
                {formatDate(patient.created_at)}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-sora font-semibold text-sm text-text-primary flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            Medical History
          </h3>
          <div className="text-sm text-text-secondary leading-relaxed max-h-32 overflow-y-auto bg-base/20 p-3 rounded border border-border-subtle/50">
            {patient.medical_history || "No medical history recorded."}
          </div>
        </div>
      </div>

      {/* Scan History Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-sora font-semibold text-text-primary flex items-center gap-2">
          <Calendar size={18} className="text-primary" />
          Scan & Assessment History
        </h2>

        <ScrollReveal>
          {loadingScans ? (
            <div className="clinical-card p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : scanHistory.length === 0 ? (
            <EmptyState
              icon={<Microscope size={48} />}
              title="No scan history"
              description="No dermatological scans have been recorded for this patient yet."
              action={
                <RippleButton onClick={() => navigate(`/scan?patient=${patient.patient_id}`)}>
                  <Microscope size={16} className="mr-2 inline" />
                  Perform First Scan
                </RippleButton>
              }
            />
          ) : (
            <div className="clinical-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Scan ID</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Diagnosis</th>
                    <th className="text-left px-4 py-3 font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 font-medium">Severity</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((scan) => (
                    <tr
                      key={scan.image_id}
                      className="border-b border-border-subtle/50 hover:bg-surface-hover/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {scan.image_id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDateTime(scan.submitted_at)}
                      </td>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {scan.top_prediction}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-mono">
                        {formatConfidence(scan.confidence)}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={scan.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/scan/${scan.image_id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium min-h-[32px]"
                        >
                          <Eye size={12} /> View Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollReveal>
      </div>
    </div>
  );
}
