from pydantic import BaseModel
from typing import Optional


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = ""
    department: Optional[str] = ""
    role: str = "doctor"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    full_name: Optional[str] = None
    department: Optional[str] = None

    class Config:
        from_attributes = True
