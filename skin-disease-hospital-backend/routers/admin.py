from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models.prediction import Prediction
from models.feedback import Feedback
from models.model_version import ModelVersion
from models.audit_log import AuditLog
from models.user import User
from routers.auth import require_admin
from services.rlhf_engine import get_feedback_stats
from services.retraining_worker import daily_retrain_task

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def admin_dashboard(db: AsyncSession = Depends(get_db),
                          admin: User = Depends(require_admin)):
    total_pred   = await db.scalar(select(func.count()).select_from(Prediction))
    total_fb     = await db.scalar(select(func.count()).select_from(Feedback))
    fb_stats     = await get_feedback_stats(db)
    active_model = (await db.execute(
        select(ModelVersion).where(ModelVersion.is_active == True)
    )).scalar_one_or_none()
    return {
        "total_predictions": total_pred,
        "total_feedback": total_fb,
        "feedback_stats": fb_stats,
        "active_model": {
            "version":    active_model.version_tag if active_model else "v1",
            "accuracy":   active_model.accuracy if active_model else None,
            "promoted_at": active_model.promoted_at if active_model else None,
        } if active_model else None,
    }


@router.get("/model-versions")
async def list_model_versions(db: AsyncSession = Depends(get_db),
                              admin: User = Depends(require_admin)):
    result = await db.execute(select(ModelVersion).order_by(ModelVersion.created_at.desc()))
    return result.scalars().all()


@router.post("/trigger-retrain")
async def trigger_retrain(db: AsyncSession = Depends(get_db),
                          admin: User = Depends(require_admin)):
    task = daily_retrain_task.delay()
    return {"status": "queued", "task_id": task.id,
            "message": "Retraining task dispatched to Celery worker."}


@router.get("/audit-logs")
async def get_audit_logs(limit: int = 100, db: AsyncSession = Depends(get_db),
                         admin: User = Depends(require_admin)):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()
