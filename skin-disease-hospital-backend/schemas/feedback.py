from pydantic import BaseModel
from typing import Optional


class FeedbackResponse(BaseModel):
    status: str
    message: str
    image_id: str
    vote: str
    will_be_used_for_training: bool
