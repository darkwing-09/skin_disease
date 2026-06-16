from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "DermAI Hospital API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["*"]
    API_BASE_URL: str = "http://localhost:7860"

    DATABASE_URL: str = "postgresql+asyncpg://dermuser:dermpass@localhost:5432/dermaidb"
    DATABASE_SYNC_URL: str = "postgresql://dermuser:dermpass@localhost:5432/dermaidb"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    SECRET_KEY: str = "CHANGE_THIS_TO_A_RANDOM_256BIT_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8-hour hospital shift

    DEFAULT_ADMIN_ENABLED: bool = True
    DEFAULT_ADMIN_USERNAME: str = "hospital_admin"
    DEFAULT_ADMIN_PASSWORD: str = "SecurePassword2026!"
    DEFAULT_ADMIN_EMAIL: str = "hospital_admin@dermai.hospital"
    DEFAULT_ADMIN_FULL_NAME: str = "Hospital Administrator"
    DEFAULT_ADMIN_DEPARTMENT: str = "IT"

    DATA_DIR: str = "/app/data"
    IMAGES_DIR: str = "/app/data/images"
    REPORTS_DIR: str = "/app/data/reports"
    FEEDBACK_DS_DIR: str = "/app/data/feedback_ds"
    MODELS_DIR: str = "/app/data/models"
    INITIAL_MODEL_PATH: str = "/app/data/models/model_v1.keras"

    MODEL_INPUT_WIDTH: int = 100
    MODEL_INPUT_HEIGHT: int = 75

    MIN_FEEDBACK_SAMPLES_FOR_RETRAIN: int = 2
    RETRAIN_EPOCHS: int = 3
    RETRAIN_BATCH_SIZE: int = 16
    RETRAIN_SCHEDULE_HOUR: int = 0

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
