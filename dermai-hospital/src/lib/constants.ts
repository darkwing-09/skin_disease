export const DISEASE_CLASSES = [
  "Psoriasis / Lichen Planus",
  "Melanocytic Nevi",
  "BKL (Benign Keratosis-like Lesions)",
  "Seborrheic Keratoses",
  "Basal Cell Carcinoma",
  "Melanoma",
  "Eczema",
  "Atopic Dermatitis",
  "Warts / Viral Infection",
  "Tinea / Fungal Infection",
];

export const SEVERITY_STYLES: Record<
  string,
  { bg: string; border: string; text: string; pulse: boolean }
> = {
  Critical: { bg: "bg-red-600",     border: "border-red-600",     text: "text-white", pulse: true  },
  Severe:   { bg: "bg-orange-500",  border: "border-orange-500",  text: "text-white", pulse: false },
  Moderate: { bg: "bg-amber-500",   border: "border-amber-500",   text: "text-white", pulse: false },
  Mild:     { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-white", pulse: false },
  High:     { bg: "bg-orange-500",  border: "border-orange-500",  text: "text-white", pulse: false },
  Low:      { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-white", pulse: false },
};

export const CLASS_METADATA: Record<
  string,
  { description: string; severity: "Low" | "Moderate" | "High" | "Critical"; action: string; icd_code: string }
> = {
  Eczema: {
    description: "A chronic inflammatory skin condition causing dry, itchy, and inflamed patches.",
    severity: "Moderate",
    action: "Prescribe topical corticosteroids. Schedule follow-up in 2 weeks.",
    icd_code: "L20.9",
  },
  Melanoma: {
    description: "A malignant tumor of melanocytes — the most dangerous form of skin cancer.",
    severity: "Critical",
    action: "URGENT: Refer to oncology immediately. Biopsy required within 48 hours.",
    icd_code: "C43.9",
  },
  "Atopic Dermatitis": {
    description: "A chronic form of eczema common in children, causing intense itching.",
    severity: "Moderate",
    action: "Prescribe emollients and mild topical steroids. Allergen panel recommended.",
    icd_code: "L20.0",
  },
  "Basal Cell Carcinoma": {
    description: "The most common skin cancer. Slow-growing and rarely spreads.",
    severity: "High",
    action: "Refer to dermatology for excision. Non-urgent but within 4 weeks.",
    icd_code: "C44.91",
  },
  "Melanocytic Nevi": {
    description: "Benign proliferations of melanocytes. Common benign moles. Monitor for ABCDE changes.",
    severity: "Low",
    action: "Document and monitor. ABCDE rule check. Annual follow-up.",
    icd_code: "D22.9",
  },
  "BKL (Benign Keratosis-like Lesions)": {
    description: "Non-cancerous surface growths. Cosmetically bothersome but harmless.",
    severity: "Low",
    action: "Reassure patient. Cryotherapy if cosmetically bothersome.",
    icd_code: "L82.1",
  },
  "Psoriasis / Lichen Planus": {
    description: "Chronic autoimmune skin conditions causing scaly, itchy plaques.",
    severity: "Moderate",
    action: "Topical vitamin D analogues + corticosteroids. Refer to rheumatology if systemic.",
    icd_code: "L40.0",
  },
  "Seborrheic Keratoses": {
    description: "Harmless, waxy age-related skin growths. Very common in adults over 50.",
    severity: "Low",
    action: "No treatment required. Reassure patient. Removal optional.",
    icd_code: "L82.1",
  },
  "Tinea / Fungal Infection": {
    description: "Fungal skin infections including ringworm, tinea pedis, and tinea corporis.",
    severity: "Moderate",
    action: "Prescribe topical antifungals (clotrimazole). Culture swab recommended.",
    icd_code: "B35.9",
  },
  "Warts / Viral Infection": {
    description: "HPV-caused skin growths. Common in children and immunocompromised patients.",
    severity: "Low",
    action: "Cryotherapy or salicylic acid. HPV vaccination if not received.",
    icd_code: "B07.9",
  },
};
