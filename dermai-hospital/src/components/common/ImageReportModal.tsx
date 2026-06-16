import { useState } from "react";
import { X, ZoomIn, ZoomOut, Download, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
}

export function ImageReportModal({ open, onClose, imageUrl, fileName }: Props) {
  const [scale, setScale] = useState(1);

  function handleZoomIn() {
    setScale((s) => Math.min(s + 0.25, 3));
  }

  function handleZoomOut() {
    setScale((s) => Math.max(s - 0.25, 0.5));
  }

  function handleReset() {
    setScale(1);
  }

  async function handleDownload() {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = fileName;
      link.target = "_blank";
      link.click();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-base/95 backdrop-blur-md flex flex-col"
        >
          {/* Header controls */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface/50">
            <span className="font-sora font-semibold text-sm text-text-primary">
              Annotated Report Image Viewer
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomIn}
                className="p-2 bg-surface hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-border-subtle"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-surface hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-border-subtle"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={handleReset}
                className="p-2 bg-surface hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-border-subtle"
                title="Reset Zoom"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 bg-surface hover:bg-surface-hover rounded text-text-secondary hover:text-text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-border-subtle"
                title="Download Image"
              >
                <Download size={16} />
              </button>

              <div className="w-[1px] h-6 bg-border-subtle mx-2" />

              <button
                onClick={onClose}
                className="p-2 bg-danger-critical/10 hover:bg-danger-critical/20 rounded text-danger-critical transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center border border-danger-critical/20"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Interactive Image Container */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
            <motion.div
              style={{ scale }}
              className="max-h-full max-w-full flex items-center justify-center transition-transform duration-150"
            >
              <img
                src={imageUrl}
                alt="Annotated Report"
                className="max-h-[80vh] max-w-[90vw] object-contain rounded-md shadow-2xl border border-border-subtle"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
