import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, X, FileImage } from "lucide-react";
import { toast } from "sonner";

interface Props {
  file: File | null;
  onSelectFile: (file: File | null) => void;
}

export function ImageDropzone({ file, onSelectFile }: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selected = acceptedFiles[0];
      if (!selected) return;

      if (selected.size > 15 * 1024 * 1024) {
        toast.error("File is too large. Max size is 15 MB.");
        return;
      }

      onSelectFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
    },
    [onSelectFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
  });

  function removeFile(e: React.MouseEvent) {
    e.stopPropagation();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    onSelectFile(null);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-text-secondary font-medium">
        Step 2 — Upload Skin Image
      </label>

      {file && preview ? (
        <div className="relative clinical-card p-4 space-y-4">
          <div className="relative aspect-video w-full rounded overflow-hidden bg-base border border-border-subtle flex items-center justify-center">
            <img
              src={preview}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
            />
            <button
              onClick={removeFile}
              className="absolute top-2 right-2 p-1.5 bg-base/80 hover:bg-base rounded-full text-text-secondary hover:text-text-primary transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center border border-border-subtle"
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-base/40 p-3 rounded border border-border-subtle/50">
            <FileImage className="text-primary" size={20} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {file.name}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {formatBytes(file.size)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`relative h-64 rounded-card border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-200 outline-none ${
            isDragActive
              ? "border-primary bg-primary/5 scale-[0.99]"
              : "border-border-subtle bg-surface hover:border-primary/45 hover:bg-surface-hover/30"
          }`}
        >
          <input {...getInputProps()} />

          {/* SVG Animated Breathing/Dashing Border */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-card">
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="none"
              rx="10"
              ry="10"
              stroke="#0EA5E9"
              strokeWidth="2"
              strokeDasharray="8, 6"
              className={`opacity-0 transition-opacity duration-200 ${
                isDragActive ? "opacity-100 animate-dash" : ""
              }`}
            />
          </svg>

          <div className="p-4 rounded-full bg-base border border-border-subtle text-text-secondary mb-4 group-hover:text-primary transition-colors">
            <Camera size={28} className={isDragActive ? "text-primary" : ""} />
          </div>

          <p className="font-sora font-semibold text-sm text-text-primary">
            {isDragActive
              ? "Drop the image here"
              : "Drag skin image here, or click to browse"}
          </p>
          <p className="text-xs text-text-secondary mt-1.5 max-w-[240px]">
            Supports JPG, PNG, and WEBP. Maximum file size 15 MB.
          </p>
        </div>
      )}
    </div>
  );
}
