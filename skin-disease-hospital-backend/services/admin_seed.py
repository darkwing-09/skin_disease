from passlib.context import CryptContext
from sqlalchemy import or_, select

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
            select(User).where(
                or_(
                    User.username == settings.DEFAULT_ADMIN_USERNAME,
                    User.email == settings.DEFAULT_ADMIN_EMAIL,
                )
            )
        )
        admin = result.scalar_one_or_none()
        password_hash = pwd_ctx.hash(settings.DEFAULT_ADMIN_PASSWORD)

        if admin:
            admin.username = settings.DEFAULT_ADMIN_USERNAME
            admin.email = settings.DEFAULT_ADMIN_EMAIL
            admin.full_name = settings.DEFAULT_ADMIN_FULL_NAME
            admin.department = settings.DEFAULT_ADMIN_DEPARTMENT
            admin.role = "admin"
            admin.is_active = True
            admin.password_hash = password_hash
            action = "updated"
        else:
            admin = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=password_hash,
                role="admin",
                full_name=settings.DEFAULT_ADMIN_FULL_NAME,
                department=settings.DEFAULT_ADMIN_DEPARTMENT,
                is_active=True,
            )
            db.add(admin)
            action = "created"

        await db.commit()
        print(f"[STARTUP] Default admin {action}: {settings.DEFAULT_ADMIN_USERNAME}")
