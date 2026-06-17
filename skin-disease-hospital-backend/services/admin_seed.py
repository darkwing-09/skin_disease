from passlib.context import CryptContext
from sqlalchemy import select

from config import get_settings
from database import AsyncSessionLocal
from models.user import User

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


async def ensure_default_admin() -> None:
    if not settings.DEFAULT_ADMIN_ENABLED:
        print("[STARTUP] Default admin seed disabled.")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.username == settings.DEFAULT_ADMIN_USERNAME)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            result = await db.execute(
                select(User).where(User.email == settings.DEFAULT_ADMIN_EMAIL)
            )
            admin = result.scalar_one_or_none()
        if admin:
            admin.username = settings.DEFAULT_ADMIN_USERNAME
            admin.email = settings.DEFAULT_ADMIN_EMAIL
            admin.full_name = settings.DEFAULT_ADMIN_FULL_NAME
            admin.department = settings.DEFAULT_ADMIN_DEPARTMENT
            admin.role = "admin"
            admin.is_active = True
            try:
                password_is_current = pwd_ctx.verify(
                    settings.DEFAULT_ADMIN_PASSWORD,
                    admin.password_hash,
                )
            except Exception:
                password_is_current = False
            if not password_is_current:
                admin.password_hash = pwd_ctx.hash(settings.DEFAULT_ADMIN_PASSWORD)
            action = "updated"
        else:
            admin = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=pwd_ctx.hash(settings.DEFAULT_ADMIN_PASSWORD),
                role="admin",
                full_name=settings.DEFAULT_ADMIN_FULL_NAME,
                department=settings.DEFAULT_ADMIN_DEPARTMENT,
                is_active=True,
            )
            db.add(admin)
            action = "created"

        await db.commit()
        print(f"[STARTUP] Default admin {action}: {settings.DEFAULT_ADMIN_USERNAME}")
