import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { RippleButton } from "@/components/common/RippleButton";

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center space-y-5">
      <div className="p-4 rounded-full bg-danger-critical/10 text-danger-critical border border-danger-critical/20">
        <ShieldAlert size={48} />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-4xl font-sora font-extrabold text-text-primary">
          404 — Page Not Found
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          The clinical dashboard route you requested does not exist or has been relocated. Please verify the URL or return to dashboard.
        </p>
      </div>

      <Link to="/dashboard">
        <RippleButton>
          <ArrowLeft size={16} className="mr-2 inline" />
          Back to Dashboard
        </RippleButton>
      </Link>
    </div>
  );
}
