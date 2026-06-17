import { useState } from "react";
import { FileDown, Image as ImageIcon, AlertTriangle, Loader2 } from "lucide-react";
import type { PredictionResult } from "@/types";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { ProbabilityBreakdown } from "@/components/scan/ProbabilityBreakdown";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { useReportImage, useReportPdf } from "@/hooks/usePrediction";
import { ImageReportModal } from "@/components/common/ImageReportModal";
import { RippleButton } from "@/components/common/RippleButton";
import { getConfidenceLevel } from "@/utils/confidence";

interface Props {
  result: PredictionResult;
  initialFeedbackSubmitted?: boolean;
}

export function ScanResultPanel({ result, initialFeedbackSubmitted = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const confMeta = getConfidenceLevel(result.confidence);

  // Fetch report images and PDFs as protected blob URLs
  const { data: imageBlobUrl, isLoading: loadingImage } = useReportImage(result.image_id);
  const { data: pdfBlobUrl, isLoading: loadingPdf } = useReportPdf(result.image_id);

  function handleDownloadPdf() {
    if (!pdfBlobUrl) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `DermAI_ClinicalReport_${result.image_id.slice(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Diagnosis Card */}
      <div className="clinical-card p-6 flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            Severity:<SeverityBadge severity={result.severity} />
            <span className="font-mono text-xs text-text-tertiary px-2 py-1 bg-base border border-border-subtle rounded">
              ICD-10: {result.icd_code}
            </span>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-sora font-extrabold text-text-primary">
              {result.top_prediction}
            </h2>
            <p className="text-text-secondary text-sm mt-1.5 leading-relaxed">
              {result.description}
            </p>
          </div>

          {result.recommended_action && (
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-card flex gap-3 items-start">
              <AlertTriangle className="text-warning shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-xs font-semibold text-warning">
                  Recommended Action
                </p>
                <p className="text-xs text-text-primary mt-0.5 leading-normal">
                  {result.recommended_action}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col items-center justify-center p-4 bg-base/30 rounded-card border border-border-subtle/40 self-stretch md:self-auto min-w-[160px]">
          <div className="flex flex-col items-center gap-2">
            <span
              className={`px-3 py-1 rounded-md text-sm font-bold tracking-wider ${confMeta.badgeClass}`}
            >
              {confMeta.emoji} HIGH
            </span>

            <div className="text-sm text-slate-400">AI Confidence</div>
          </div>
        </div>
      </div>

      {/* Probability Breakdown */}
      <ProbabilityBreakdown classes={result.all_classes} />

      {/* Report Section */}
      <div className="clinical-card p-6 space-y-4">
        <h3 className="font-sora font-semibold text-sm text-text-primary">
          Clinical Artifacts
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Report Image Card */}
          <div className="clinical-card p-4 flex flex-col gap-3 justify-between">
            <div className="aspect-video w-full rounded overflow-hidden bg-base border border-border-subtle flex items-center justify-center relative group">
              {loadingImage ? (
                <div className="flex flex-col items-center gap-2 text-text-tertiary">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Loading report preview…</span>
                </div>
              ) : imageBlobUrl ? (
                <img
                  src={imageBlobUrl}
                  alt="Annotated Report Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-text-tertiary">No preview available</span>
              )}
            </div>

            <RippleButton
              variant="ghost"
              onClick={() => setModalOpen(true)}
              disabled={!imageBlobUrl}
              className="w-full mt-2"
            >
              <ImageIcon size={14} className="mr-2 inline" />
              View Annotated Image
            </RippleButton>
          </div>

          {/* PDF Card */}
          <div className="clinical-card p-4 flex flex-col justify-between">
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-base/20 border border-dashed border-border-subtle/70 rounded mb-4">
              <span className="text-3xl mb-2">📄</span>
              <p className="text-xs font-semibold text-text-primary">
                A4 Clinical PDF Report
              </p>
              <p className="text-[11px] text-text-secondary mt-1 max-w-[200px]">
                Fully formatted clinical document suitable for printing and archiving.
              </p>
            </div>

            <RippleButton
              variant="primary"
              onClick={handleDownloadPdf}
              disabled={loadingPdf || !pdfBlobUrl}
              className="w-full"
            >
              {loadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
              ) : (
                <FileDown size={14} className="mr-2 inline" />
              )}
              Download PDF Report
            </RippleButton>
          </div>
        </div>
      </div>

      {/* Feedback Section */}
      <FeedbackWidget
        imageId={result.image_id}
        initialFeedbackSubmitted={initialFeedbackSubmitted}
      />

      {/* Annotated Image Modal */}
      {imageBlobUrl && (
        <ImageReportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          imageUrl={imageBlobUrl}
          fileName={`DermAI_Report_${result.image_id.slice(0, 8)}.png`}
        />
      )}
    </div>
  );
}
