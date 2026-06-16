from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os

from database import get_db
from models.prediction import Prediction
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{image_id}/image")
async def get_report_image(image_id: str, db: AsyncSession = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_image_path or not os.path.exists(pred.report_image_path):
        raise HTTPException(status_code=404, detail="Report image not found")
    return FileResponse(pred.report_image_path, media_type="image/png",
                        filename=f"DermAI_Report_{image_id[:8]}.png")


@router.get("/{image_id}/pdf")
async def get_report_pdf(image_id: str, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_pdf_path or not os.path.exists(pred.report_pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not found")
    return FileResponse(pred.report_pdf_path, media_type="application/pdf",
                        filename=f"DermAI_ClinicalReport_{image_id[:8]}.pdf")
