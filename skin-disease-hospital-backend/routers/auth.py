from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import uuid

from database import get_db
from models.user import User
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(user: User) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "session_version": user.session_version,
        "exp": exp,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        token_session_version = payload.get("session_version")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user_id or token_session_version is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user_uuid = uuid.UUID(str(user_id))
        token_session_version = int(token_session_version)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if user.session_version != token_session_version:
        raise HTTPException(status_code=401, detail="Session replaced by a newer login")
    return user


async def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@router.post("/register")
async def register(username: str, email: str, password: str,
                   full_name: str = "", department: str = "", role: str = "doctor",
                   db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=username, email=email, full_name=full_name,
                department=department, role=role, password_hash=pwd_ctx.hash(password))
    db.add(user)
    await db.commit()
    return {"id": str(user.id), "username": user.username, "role": user.role}


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    username = form.username.strip()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not pwd_ctx.verify(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.session_version = (user.session_version or 0) + 1
    await db.commit()
    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer",
            "role": user.role, "full_name": user.full_name}
