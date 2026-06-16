import { api } from "./client";
import type { PredictionResult } from "@/types";
import { fetchPatientByUuid, fetchPatients } from "./patients";
import { CLASS_METADATA } from "@/lib/constants";
import { normalizePercent } from "@/lib/utils";

function normalizePredictionResult(
  data: any,
  imageId?: string,
  patientInfo = data.patient
): PredictionResult {
  const meta = CLASS_METADATA[data.top_prediction] || {
    description: "Unknown condition",
    severity: "Low" as const,
    action: "No action specified.",
    icd_code: "N/A",
  };

  let allClasses = data.all_classes;
  if (allClasses) {
    allClasses = allClasses
      .map((item: any, index: number) => ({
        rank: item.rank || index + 1,
        label: item.label,
        confidence: normalizePercent(item.confidence),
      }))
      .sort((a: any, b: any) => b.confidence - a.confidence)
      .map((item: any, idx: number) => ({ ...item, rank: idx + 1 }));
  } else if (data.all_probabilities) {
    allClasses = Object.entries(data.all_probabilities)
      .map(([label, val]: any, i) => ({
        rank: i + 1,
        label,
        confidence: normalizePercent(val),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  const resolvedImageId = data.image_id || imageId || "";
  const base = `${import.meta.env.VITE_API_URL}/reports/${resolvedImageId}`;

  return {
    image_id: resolvedImageId,
    patient: patientInfo || {
      full_name: "Unknown Patient",
      patient_id: "N/A",
      date_of_birth: "N/A",
      gender: "N/A",
      blood_group: null,
    },
    top_prediction: data.top_prediction,
    confidence: normalizePercent(data.confidence),
    description: data.description || meta.description,
    severity: data.severity || meta.severity,
    recommended_action: data.recommended_action || meta.action,
    icd_code: data.icd_code || meta.icd_code,
    all_classes: allClasses || [],
    model_version: data.model_version || "v1",
    submitted_at: data.created_at || data.submitted_at || new Date().toISOString(),
    report_url: data.report_url || `${base}/image`,
    report_pdf_url: data.report_pdf_url || `${base}/pdf`,
    disclaimer: data.disclaimer || "⚠ AI-assisted diagnosis. Final interpretation by licensed physician required.",
    doctor_notes: data.doctor_notes,
  };
}

export async function submitPrediction(
  patientId: string,
  file: File,
  doctorNotes: string
): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append("patient_id", patientId);
  formData.append("file", file);
  if (doctorNotes) formData.append("doctor_notes", doctorNotes);

  const { data } = await api.post<PredictionResult>("/predict/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return normalizePredictionResult(data);
}

export async function fetchPrediction(imageId: string): Promise<PredictionResult> {
  const { data } = await api.get<any>(`/predict/${imageId}`);

  // Fetch patient details if missing in GET response (database UUID mapping)
  let patientInfo = data.patient;
  if (!patientInfo && data.patient_id) {
    try {
      const patients = await fetchPatients();
      const patient = patients.find(p => p.id === data.patient_id || p.patient_id === data.patient_id);
      if (patient) {
        patientInfo = {
          full_name: patient.full_name,
          patient_id: patient.patient_id,
          date_of_birth: patient.date_of_birth,
          gender: patient.gender,
          blood_group: patient.blood_group,
        };
      } else {
        const directPatient = await fetchPatientByUuid(data.patient_id);
        patientInfo = {
          full_name: directPatient.full_name,
          patient_id: directPatient.patient_id,
          date_of_birth: directPatient.date_of_birth,
          gender: directPatient.gender,
          blood_group: directPatient.blood_group,
        };
      }
    } catch {
      patientInfo = {
        full_name: "Unknown Patient",
        patient_id: "N/A",
        date_of_birth: "N/A",
        gender: "N/A",
        blood_group: null,
      };
    }
  }
  return normalizePredictionResult(data, imageId, patientInfo);
}

// Reports require auth headers, so we fetch them as blobs and create object URLs
// rather than using <img src="..."> directly against a protected endpoint.
export async function fetchReportImageBlobUrl(imageId: string): Promise<string> {
  const { data } = await api.get(`/reports/${imageId}/image`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

export async function fetchReportPdfBlobUrl(imageId: string): Promise<string> {
  const { data } = await api.get(`/reports/${imageId}/pdf`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}
