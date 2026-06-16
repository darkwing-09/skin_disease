"""
RLHF feedback collection engine.
"""

import os
import shutil
import logging
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from models.feedback import Feedback
from models.prediction import Prediction
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def collect_rlhf_dataset(db: AsyncSession) -> dict:
    stmt = (
        select(Feedback, Prediction)
        .join(Prediction, Feedback.prediction_id == Prediction.id)
        .where(Feedback.used_in_train == False)
    )
    results = await db.execute(stmt)
    rows = results.all()
    if not rows:
        return {"samples": [], "count": 0}

    samples, feedback_ids = [], []
    for fb, pred in rows:
        label = pred.top_prediction if fb.vote == "up" else fb.correct_label
        if not label or not pred.original_image_path or not os.path.exists(pred.original_image_path):
            continue
        dest_dir = os.path.join(settings.FEEDBACK_DS_DIR,
                                label.replace("/", "_").replace(" ", "_"))
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, f"{pred.image_id}.jpg")
        shutil.copy2(pred.original_image_path, dest)
        samples.append({"image_path": dest, "label": label})
        feedback_ids.append(fb.id)

    if feedback_ids:
        await db.execute(
            update(Feedback).where(Feedback.id.in_(feedback_ids)).values(used_in_train=True)
        )
        await db.commit()

    logger.info(f"[RLHF] Collected {len(samples)} new training samples from feedback.")
    return {"samples": samples, "count": len(samples)}


async def get_feedback_stats(db: AsyncSession) -> dict:
    from sqlalchemy import func
    total_up   = await db.scalar(select(func.count()).where(Feedback.vote == "up"))
    total_down = await db.scalar(select(func.count()).where(Feedback.vote == "down"))
    unused     = await db.scalar(select(func.count()).where(Feedback.used_in_train == False))
    total = max((total_up or 0) + (total_down or 0), 1)
    return {
        "total_upvotes":       total_up or 0,
        "total_downvotes":     total_down or 0,
        "pending_for_retrain": unused or 0,
        "accuracy_signal":     round(((total_up or 0) / total) * 100, 2),
    }
