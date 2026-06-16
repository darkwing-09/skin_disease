from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class PatientCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    patient_id: str
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
