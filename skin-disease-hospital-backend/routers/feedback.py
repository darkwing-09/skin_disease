from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.feedback import Feedback
from models.prediction import Prediction
from models.user import User
from schemas.prediction import FeedbackRequest
from routers.auth import get_current_user
from middleware.audit_logger import log_action
from services.model_utils import CLASS_NAMES

router = APIRouter(prefix="/feedback", tags=["RLHF Feedback"])


@router.post("/", status_code=201)
async def submit_feedback(
    data: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    👍 vote=up  → model was correct, adds to positive RLHF pool
    👎 vote=down → provide correct_label; adds corrected sample to retrain pool
    """
    pred_result = await db.execute(select(Prediction).where(Prediction.image_id == data.image_id))
    prediction = pred_result.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail=f"No prediction found for image_id: {data.image_id}")

    if data.vote == "down":
        if not data.correct_label:
            raise HTTPException(status_code=400,
                                detail="correct_label required for down-vote.")
        if data.correct_label not in CLASS_NAMES:
            raise HTTPException(status_code=400,
                                detail=f"Invalid correct_label. Must be one of: {CLASS_NAMES}")

    existing = await db.execute(
        select(Feedback).where(
            Feedback.prediction_id == prediction.id,
            Feedback.submitted_by == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Feedback already submitted for this image.")

    fb = Feedback(prediction_id=prediction.id, submitted_by=current_user.id,
                  vote=data.vote, correct_label=data.correct_label,
                  notes=data.notes, used_in_train=False)
    db.add(fb)
    prediction.status = "reviewed"
    await db.commit()

    await log_action(db, current_user.id, "FEEDBACK_SUBMITTED", "feedback",
                     prediction.id, {"vote": data.vote, "image_id": data.image_id})

    return {
        "status": "success",
        "message": f"Feedback recorded: {data.vote.upper()}",
        "image_id": data.image_id,
        "vote": data.vote,
        "will_be_used_for_training": True,
    }
