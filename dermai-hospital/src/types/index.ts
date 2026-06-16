export type Severity = "Low" | "Moderate" | "High" | "Critical";

export interface User {
  id: string;
  username: string;
  role: "admin" | "doctor";
}

export interface Patient {
  id: string;
  patient_id: string; // HOSP-YYYY-NNNNN
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | "Other";
  blood_group: string | null;
  contact_number: string | null;
  medical_history: string | null;
  assigned_doctor: string;
  created_at: string;
  updated_at: string;
}

export interface PredictionClass {
  rank: number;
  label: string;
  // Normalized percentage in the 0-100 range.
  confidence: number;
}

export interface PredictionResult {
  image_id: string;
  patient: {
    full_name: string;
    patient_id: string;
    date_of_birth: string;
    gender: string;
    blood_group: string | null;
  };
  top_prediction: string;
  // Normalized percentage in the 0-100 range.
  confidence: number;
  description: string;
  severity: Severity;
  recommended_action: string;
  icd_code: string;
  all_classes: PredictionClass[];
  model_version: string;
  submitted_at: string;
  report_url: string;
  report_pdf_url: string;
  disclaimer: string;
  doctor_notes?: string;
}

export interface FeedbackPayload {
  image_id: string;
  vote: "up" | "down";
  correct_label?: string;
  notes?: string;
}

export interface AdminDashboard {
  total_predictions: number;
  total_feedback: number;
  feedback_stats: {
    total_upvotes: number;
    total_downvotes: number;
    pending_for_retrain: number;
    accuracy_signal: number;
  };
  active_model: {
    version: string;
    accuracy: number | null;
    promoted_at: string | null;
  };
}

export interface ModelVersion {
  version: string;
  accuracy: number | null;
  status: "active" | "previous";
  promoted_at: string | null;
}
