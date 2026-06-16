from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PredictionClass(BaseModel):
    rank: int
    label: str
    confidence: float


class PatientInfoForReport(BaseModel):
    patient_id: str
    full_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None


class PredictionResponse(BaseModel):
    image_id: str
    patient: PatientInfoForReport
    top_prediction: str
    confidence: float
    description: str
    severity: str
    recommended_action: str
    icd_code: str
    all_classes: list[PredictionClass]
    model_version: str
    submitted_at: datetime
    report_url: str
    report_pdf_url: str
    disclaimer: str

    class Config:
        from_attributes = True


class FeedbackRequest(BaseModel):
    image_id: str
    vote: str = Field(..., pattern="^(up|down)$")
    correct_label: Optional[str] = None
    notes: Optional[str] = None
