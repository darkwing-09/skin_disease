from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload
import uuid, os, aiofiles

from database import get_db
from models.prediction import Prediction
from models.patient import Patient
from models.user import User
from services.model_utils import run_inference
from services.report_generator import generate_annotated_image, generate_pdf_report
from routers.auth import get_current_user
from middleware.audit_logger import log_action
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/predict", tags=["Predictions"])


def serialize_prediction(pred: Prediction, patient: Patient | None = None) -> dict:
    patient_info = patient or pred.patient
    patient_dict = None
    if patient_info:
        patient_dict = {
            "full_name": patient_info.full_name,
            "patient_id": patient_info.patient_id,
            "date_of_birth": str(patient_info.date_of_birth) if patient_info.date_of_birth else "N/A",
            "gender": patient_info.gender or "N/A",
            "blood_group": patient_info.blood_group or "N/A",
        }

    base = f"{settings.API_BASE_URL}/reports/{pred.image_id}"
    return {
        "id": str(pred.id),
        "image_id": pred.image_id,
        "patient_id": str(pred.patient_id),
        "patient": patient_dict,
        "submitted_by": str(pred.submitted_by),
        "top_prediction": pred.top_prediction,
        "confidence": pred.confidence,
        "all_probabilities": pred.all_probabilities,
        "model_version": pred.model_version,
        "status": pred.status,
        "doctor_notes": pred.doctor_notes,
        "created_at": pred.created_at,
        "submitted_at": pred.created_at,
        "report_url": f"{base}/image",
        "report_pdf_url": f"{base}/pdf",
    }


@router.post("/", status_code=201)
async def predict_disease(
    patient_id: str = Form(...),
    file: UploadFile = File(...),
    doctor_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WEBP accepted.")
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 15 MB.")

    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    image_id = str(uuid.uuid4())
    os.makedirs(settings.IMAGES_DIR, exist_ok=True)
    img_path = os.path.join(settings.IMAGES_DIR, f"{image_id}.jpg")
    async with aiofiles.open(img_path, "wb") as f:
        await f.write(contents)

    try:
        inference = run_inference(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    patient_dict = {
        "full_name":    patient.full_name,
        "patient_id":   patient.patient_id,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else "N/A",
        "gender":       patient.gender or "N/A",
        "blood_group":  patient.blood_group or "N/A",
    }

    report_png = generate_annotated_image(
        image_bytes=contents, patient=patient_dict, prediction=inference,
        image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
        department=current_user.department or "Dermatology",
    )
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    report_img_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.png")
    async with aiofiles.open(report_img_path, "wb") as f:
        await f.write(report_png)

    pdf_bytes = generate_pdf_report(
        annotated_image_path=report_img_path, patient=patient_dict,
        prediction=inference, image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
    )
    report_pdf_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.pdf")
    async with aiofiles.open(report_pdf_path, "wb") as f:
        await f.write(pdf_bytes)

    pred_record = Prediction(
        image_id=image_id, patient_id=patient.id, submitted_by=current_user.id,
        original_image_path=img_path, report_image_path=report_img_path,
        report_pdf_path=report_pdf_path, top_prediction=inference["top_prediction"],
        confidence=inference["confidence"], all_probabilities=inference["all_probabilities"],
        model_version=inference["model_version"], doctor_notes=doctor_notes, status="pending",
    )
    db.add(pred_record)
    await db.commit()
    await db.refresh(pred_record)

    await log_action(db, current_user.id, "PREDICTION_CREATED", "prediction", pred_record.id,
                     {"image_id": image_id, "patient_id": patient_id,
                      "top_prediction": inference["top_prediction"]})

    base = f"{settings.API_BASE_URL}/reports/{image_id}"
    return {
        "image_id":           image_id,
        "patient":            patient_dict,
        "top_prediction":     inference["top_prediction"],
        "confidence":         inference["confidence"],
        "description":        inference["description"],
        "severity":           inference["severity"],
        "recommended_action": inference["recommended_action"],
        "icd_code":           inference["icd_code"],
        "all_classes":        inference["all_classes"],
        "model_version":      inference["model_version"],
        "submitted_at":       pred_record.created_at,
        "report_url":         f"{base}/image",
        "report_pdf_url":     f"{base}/pdf",
        "disclaimer": "⚠ AI-assisted diagnosis. Final interpretation by licensed physician required.",
    }


@router.get("/patient/{patient_id}")
async def list_patient_predictions(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient_filters = [Patient.patient_id == patient_id]
    try:
        patient_filters.append(Patient.id == uuid.UUID(patient_id))
    except ValueError:
        pass

    patient_result = await db.execute(select(Patient).where(or_(*patient_filters)))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    result = await db.execute(
        select(Prediction)
        .where(Prediction.patient_id == patient.id)
        .order_by(Prediction.created_at.desc())
    )
    return [serialize_prediction(pred, patient) for pred in result.scalars().all()]


@router.get("/{image_id}")
async def get_prediction(image_id: str, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Prediction)
        .options(selectinload(Prediction.patient))
        .where(Prediction.image_id == image_id)
    )
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return serialize_prediction(pred)
