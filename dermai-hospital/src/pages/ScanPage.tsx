import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Microscope, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { usePatients } from "@/hooks/usePatients";
import { useSubmitPrediction } from "@/hooks/usePrediction";
import { PatientPicker } from "@/components/scan/PatientPicker";
import { ImageDropzone } from "@/components/scan/ImageDropzone";
import { PatientDrawer } from "@/components/patients/PatientDrawer";
import { ScanResultPanel } from "@/components/scan/ScanResultPanel";
import { RippleButton } from "@/components/common/RippleButton";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { Patient, PredictionResult } from "@/types";

export default function ScanPage() {
  const [searchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");

  const { data: patients = [] } = usePatients();
  const { mutateAsync: submitPrediction, isPending: submitting, error } = useSubmitPrediction();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // loading state steps
  const [loadingStep, setLoadingStep] = useState(0);

  // Pre-fill patient from query param if available
  useEffect(() => {
    if (patientParam && patients.length > 0) {
      const match = patients.find(
        (p) => p.patient_id.toLowerCase() === patientParam.toLowerCase()
      );
      if (match) {
        setSelectedPatient(match);
      }
    }
  }, [patientParam, patients]);

  // Loading animation step timer
  useEffect(() => {
    let interval: any;
    if (submitting) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, 3));
      }, 900);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [submitting]);

  async function handleAnalyze() {
    if (!selectedPatient || !file) return;
    setResult(null);
    try {
      const res = await submitPrediction({
        patientId: selectedPatient.patient_id,
        file,
        doctorNotes,
      });
      setResult(res);
    } catch {
      // Handled in mutation hook
    }
  }

  function handleReset() {
    setFile(null);
    setDoctorNotes("");
    setResult(null);
    setLoadingStep(0);
  }

  const steps = [
    "Image received",
    "Preprocessing & normalization",
    "Running ResNet50 inference",
    "Generating annotated report & PDF",
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "New Scan" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-sora font-bold">New Skin Assessment</h1>
        <p className="text-text-secondary text-sm mt-1">
          Perform AI-assisted dermatological analysis on lesion images
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="clinical-card p-6 space-y-6">
            <PatientPicker
              patients={patients}
              selectedPatient={selectedPatient}
              onSelectPatient={setSelectedPatient}
              onRegisterClick={() => setDrawerOpen(true)}
            />

            <ImageDropzone file={file} onSelectFile={setFile} />

            <div className="space-y-2">
              <label className="block text-sm text-text-secondary font-medium">
                Step 3 — Doctor Notes (optional)
              </label>
              <textarea
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                rows={3}
                placeholder="E.g., irregular borders, patient reports rapid growth over 2 months…"
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            <RippleButton
              onClick={handleAnalyze}
              disabled={!selectedPatient || !file || submitting}
              className="w-full mt-2"
              loading={submitting}
            >
              Run AI Analysis
            </RippleButton>

            {result && (
              <RippleButton
                variant="ghost"
                onClick={handleReset}
                className="w-full border-dashed"
              >
                <RefreshCw size={14} className="mr-2 inline" />
                Reset & Run New Scan
              </RippleButton>
            )}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-7">
          {submitting ? (
            /* State 2 — Loading with Step Indicator */
            <div className="clinical-card p-8 flex flex-col items-center justify-center min-h-[400px] text-center space-y-8">
              <div className="relative flex items-center justify-center">
                <Loader2 className="text-primary w-12 h-12 animate-spin" />
                <Microscope className="absolute text-text-primary/70" size={20} />
              </div>

              <div className="space-y-2 w-full max-w-xs">
                <p className="font-sora font-semibold text-sm text-text-primary">
                  Running Neural Network…
                </p>
                <p className="text-xs text-text-secondary">
                  Please hold, medical image analysis in progress.
                </p>
              </div>

              {/* Animated Step List */}
              <div className="w-full max-w-sm space-y-3.5 bg-base/40 p-5 rounded-card border border-border-subtle/50 text-left">
                {steps.map((step, index) => {
                  let status = "pending"; // pending, active, done
                  if (loadingStep > index) status = "done";
                  else if (loadingStep === index) status = "active";

                  return (
                    <div key={index} className="flex items-center gap-3 text-xs">
                      {status === "done" && (
                        <span className="text-success font-bold shrink-0">✓</span>
                      )}
                      {status === "active" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                      )}
                      {status === "pending" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-border-strong shrink-0" />
                      )}

                      <span
                        className={
                          status === "done"
                            ? "text-text-secondary line-through opacity-70"
                            : status === "active"
                            ? "text-text-primary font-medium"
                            : "text-text-tertiary"
                        }
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : error ? (
            /* State 4 — Error Card */
            <div className="clinical-card p-8 border-danger-critical/30 bg-danger-critical/5 text-center min-h-[400px] flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-danger-critical w-12 h-12" />
              <h3 className="font-sora font-semibold text-text-primary">
                Analysis Failed
              </h3>
              <p className="text-sm text-text-secondary max-w-sm">
                There was a problem processing the lesion image. Please check the format and try again.
              </p>
              <RippleButton variant="danger" onClick={handleReset}>
                Try Again
              </RippleButton>
            </div>
          ) : result ? (
            /* State 3 — Results rendering */
            <ScrollReveal>
              <ScanResultPanel result={result} />
            </ScrollReveal>
          ) : (
            /* State 1 — Empty state */
            <div className="clinical-card p-8 border-dashed border-2 border-border-subtle flex flex-col items-center justify-center text-center min-h-[400px] space-y-4">
              <div className="p-4 rounded-full bg-surface-hover text-text-tertiary">
                <Microscope size={36} />
              </div>
              <h3 className="font-sora font-semibold text-text-primary">
                Awaiting Analysis Input
              </h3>
              <p className="text-sm text-text-secondary max-w-sm">
                Select a patient, upload a close-up image of the lesion, and run the AI prediction system.
              </p>
            </div>
          )}
        </div>
      </div>

      <PatientDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
