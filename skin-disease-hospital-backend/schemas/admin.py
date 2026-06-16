from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AdminDashboard(BaseModel):
    total_predictions: int
    total_feedback: int
    feedback_stats: dict
    active_model: Optional[dict] = None


class ModelVersionResponse(BaseModel):
    version_tag: str
    checkpoint_path: str
    training_samples: int
    accuracy: Optional[float] = None
    is_active: bool
    promoted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
