from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from database import get_db
from models.patient import Patient
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", status_code=201)
async def create_patient(
    full_name: str, gender: str = None, date_of_birth: str = None,
    contact_number: str = None, blood_group: str = None, medical_history: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_result = await db.execute(select(Patient))
    count = len(count_result.scalars().all()) + 1
    patient_id = f"HOSP-{date.today().year}-{count:05d}"

    # Parse date of birth if string
    dob = None
    if date_of_birth:
        try:
            dob = date.fromisoformat(date_of_birth)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    patient = Patient(
        patient_id=patient_id, full_name=full_name, gender=gender,
        date_of_birth=dob, contact_number=contact_number,
        blood_group=blood_group, medical_history=medical_history,
        assigned_doctor=current_user.id,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/")
async def list_patients(db: AsyncSession = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Patient))
    return result.scalars().all()


@router.get("/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
