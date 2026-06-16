# 🏥 DermAI Hospital — Full-Stack Implementation Guide (v2.0)

**Model:** ResNet50 (10-class skin disease classifier)  
**Stack:** FastAPI → PostgreSQL → Redis → Celery → HuggingFace Spaces (backend) + React → Vercel (frontend)  
**Classes:** Eczema, Melanoma, Atopic Dermatitis, Basal Cell Carcinoma, Melanocytic Nevi, BKL, Psoriasis/Lichen Planus, Seborrheic Keratoses, Tinea/Fungal Infection, Warts/Viral Infection  
**New in v2:** Patient records · Annotated image reports · ICD-10 codes · RLHF feedback loop · Daily model retraining · Audit logs · Role-based access (Doctor / Admin)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Complete Project Structure](#2-complete-project-structure)
3. [Database Schema](#3-database-schema)
4. [Core Backend Modules](#4-core-backend-modules)
   - 4.1 requirements.txt
   - 4.2 config.py
   - 4.3 database.py
   - 4.4 models/ (SQLAlchemy ORM)
   - 4.5 schemas/ (Pydantic)
   - 4.6 services/model_utils.py
   - 4.7 services/report_generator.py
   - 4.8 services/rlhf_engine.py
   - 4.9 services/retraining_worker.py
   - 4.10 middleware/audit_logger.py
5. [API Routes](#5-api-routes)
   - 5.1 routers/auth.py
   - 5.2 routers/patients.py
   - 5.3 routers/predictions.py
   - 5.4 routers/feedback.py
   - 5.5 routers/reports.py
   - 5.6 routers/admin.py
6. [app.py — Main Application](#6-apppy--main-application)
7. [Dockerfile & Docker Compose](#7-dockerfile--docker-compose)
8. [HuggingFace Deployment](#8-huggingface-deployment)
9. [Frontend Prompt (Lovable / v0)](#9-frontend-prompt-lovable--v0)
10. [Vercel Deployment](#10-vercel-deployment)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [End-to-End Flow Diagram](#12-end-to-end-flow-diagram)
13. [Deployment Checklist](#13-deployment-checklist)
14. [Robustness & Production Hardening Notes](#14-robustness--production-hardening-notes)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HOSPITAL FRONTEND (React + Vercel)              │
│                     Doctor's Dashboard / Admin Panel                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTPS REST API (JWT Bearer)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (HuggingFace Docker Space)             │
│                                                                     │
│  /auth          JWT login · role management (admin / doctor)        │
│  /patients      CRUD — patient intake, demographics                 │
│  /predict       Image upload → ResNet50 inference → store result    │
│  /report        Annotated PNG image + A4 PDF clinical report        │
│  /feedback      👍/👎 RLHF signal per prediction (by image_id)      │
│  /admin         Model metrics · retrain status · audit logs         │
│                                                                     │
└───────┬──────────────┬──────────────┬───────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌────────────────────┐
  │PostgreSQL│  │  Redis   │  │  Celery Worker     │
  │          │  │  Cache   │  │  (Daily Retrain)   │
  │ patients │  │  + Queue │  │  APScheduler Beat  │
  │ predict  │  │          │  │  00:00 UTC daily   │
  │ feedback │  └──────────┘  └────────────────────┘
  │ audit    │
  └──────────┘
        │
        ▼
  ┌──────────────────────┐
  │  /data/images/       │  Raw uploaded images stored as {image_id}.jpg
  │  /data/reports/      │  Annotated PNG + PDF per prediction
  │  /data/feedback_ds/  │  Confirmed correct samples for retraining
  │  /data/models/       │  Versioned model checkpoints (model_v1.keras, v2…)
  └──────────────────────┘
```

**Key design decisions:**
- Every prediction gets a **unique UUID `image_id`** stamped visually on the annotated report image.
- Doctors submit 👍/👎 via `image_id` → feeds the **RLHF feedback store** in PostgreSQL.
- A **Celery beat task** runs at midnight UTC: collects all confirmed samples, fine-tunes the model for N epochs, saves a versioned checkpoint, and hot-swaps it into the live process without restart.
- PostgreSQL stores a **full immutable audit trail** — every prediction, feedback event, and model version swap.
- **Role-based access**: `admin` sees everything + can trigger retraining; `doctor` sees only their own submissions.

---

## 2. Complete Project Structure

```
skin-disease-hospital-backend/
│
├── app.py                          # FastAPI entry point + lifespan
├── config.py                       # All settings via Pydantic BaseSettings
├── database.py                     # SQLAlchemy async engine + session
├── requirements.txt
├── Dockerfile
├── docker-compose.yml              # Local: API + PostgreSQL + Redis + Celery
│
├── models/                         # SQLAlchemy ORM table definitions
│   ├── __init__.py
│   ├── user.py
│   ├── patient.py
│   ├── prediction.py
│   ├── feedback.py
│   ├── audit_log.py
│   └── model_version.py
│
├── schemas/                        # Pydantic request / response schemas
│   ├── __init__.py
│   ├── auth.py
│   ├── patient.py
│   ├── prediction.py
│   ├── feedback.py
│   └── admin.py
│
├── routers/                        # FastAPI route handlers
│   ├── __init__.py
│   ├── auth.py
│   ├── patients.py
│   ├── predictions.py
│   ├── feedback.py
│   ├── reports.py
│   └── admin.py
│
├── services/                       # Business logic
│   ├── __init__.py
│   ├── model_utils.py              # ResNet50 inference + hot-swap
│   ├── report_generator.py         # PIL annotated image + PDF generation
│   ├── rlhf_engine.py              # Collect feedback, build retraining dataset
│   └── retraining_worker.py        # Celery task: daily fine-tune
│
├── middleware/
│   └── audit_logger.py             # Logs every write action to audit_logs table
│
├── data/
│   ├── images/                     # {image_id}.jpg
│   ├── reports/                    # {image_id}_report.png · {image_id}_report.pdf
│   ├── feedback_ds/                # Sorted by class label for retraining
│   └── models/
│       ├── model_v1.keras          # Initial trained model (your .keras file)
│       └── active_version.txt      # Contains "v1" (or "v3" etc.) — read at startup
│
└── README.md                       # HuggingFace Spaces YAML config header
```

---

## 3. Database Schema

```sql
-- ── USERS ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(64)  UNIQUE NOT NULL,
    email         VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'doctor',  -- 'doctor' | 'admin'
    full_name     VARCHAR(128),
    department    VARCHAR(64),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PATIENTS ──────────────────────────────────────────────────────────
CREATE TABLE patients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       VARCHAR(32) UNIQUE NOT NULL,  -- e.g. HOSP-2025-00142
    full_name        VARCHAR(128) NOT NULL,
    date_of_birth    DATE,
    gender           VARCHAR(16),
    contact_number   VARCHAR(20),
    blood_group      VARCHAR(8),
    medical_history  TEXT,
    assigned_doctor  UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── PREDICTIONS ───────────────────────────────────────────────────────
CREATE TABLE predictions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id             VARCHAR(36) UNIQUE NOT NULL,  -- printed on report
    patient_id           UUID REFERENCES patients(id) ON DELETE CASCADE,
    submitted_by         UUID REFERENCES users(id),
    original_image_path  VARCHAR(512),
    report_image_path    VARCHAR(512),
    report_pdf_path      VARCHAR(512),
    top_prediction       VARCHAR(128) NOT NULL,
    confidence           FLOAT NOT NULL,              -- 0.0–100.0
    all_probabilities    JSONB NOT NULL,              -- {class: prob%}
    model_version        VARCHAR(32),
    status               VARCHAR(16) DEFAULT 'pending',  -- pending|reviewed|archived
    doctor_notes         TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEEDBACK (RLHF) ───────────────────────────────────────────────────
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id   UUID REFERENCES predictions(id) ON DELETE CASCADE,
    submitted_by    UUID REFERENCES users(id),
    vote            VARCHAR(8) NOT NULL,    -- 'up' | 'down'
    correct_label   VARCHAR(128),           -- doctor's ground truth (down-vote only)
    notes           TEXT,
    used_in_train   BOOLEAN DEFAULT FALSE,  -- flipped after overnight retrain
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MODEL VERSIONS ────────────────────────────────────────────────────
CREATE TABLE model_versions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag      VARCHAR(32) UNIQUE NOT NULL,  -- v1, v2, v3 …
    checkpoint_path  VARCHAR(512) NOT NULL,
    training_samples INT DEFAULT 0,
    accuracy         FLOAT,                        -- validation accuracy
    is_active        BOOLEAN DEFAULT FALSE,
    promoted_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64),
    entity_id   UUID,
    ip_address  VARCHAR(64),
    payload     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_predictions_patient  ON predictions(patient_id);
CREATE INDEX idx_predictions_image_id ON predictions(image_id);
CREATE INDEX idx_feedback_prediction  ON feedback(prediction_id);
CREATE INDEX idx_feedback_unused      ON feedback(used_in_train) WHERE used_in_train = FALSE;
CREATE INDEX idx_audit_user           ON audit_logs(user_id);
CREATE INDEX idx_audit_created        ON audit_logs(created_at DESC);
```

---

## 4. Core Backend Modules

### 4.1 `requirements.txt`

```
# Web Framework
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9

# Database
sqlalchemy==2.0.30
asyncpg==0.29.0
alembic==1.13.1
psycopg2-binary==2.9.9

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# ML / Image
tensorflow==2.15.0
Pillow==10.3.0
numpy==1.26.4
reportlab==4.2.0
opencv-python-headless==4.9.0.80

# Task Queue
celery==5.3.6
redis==5.0.4

# Config
pydantic-settings==2.2.1
python-dotenv==1.0.1

# Utilities
aiofiles==23.2.1
```

---

### 4.2 `config.py`

```python
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

    DATA_DIR: str = "/app/data"
    IMAGES_DIR: str = "/app/data/images"
    REPORTS_DIR: str = "/app/data/reports"
    FEEDBACK_DS_DIR: str = "/app/data/feedback_ds"
    MODELS_DIR: str = "/app/data/models"
    INITIAL_MODEL_PATH: str = "/app/data/models/model_v1.keras"

    MODEL_INPUT_WIDTH: int = 100
    MODEL_INPUT_HEIGHT: int = 75

    MIN_FEEDBACK_SAMPLES_FOR_RETRAIN: int = 20
    RETRAIN_EPOCHS: int = 3
    RETRAIN_BATCH_SIZE: int = 16
    RETRAIN_SCHEDULE_HOUR: int = 0

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

### 4.3 `database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

---

### 4.4 `models/` (SQLAlchemy ORM)

**`models/user.py`**
```python
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="doctor")
    full_name: Mapped[str | None] = mapped_column(String(128))
    department: Mapped[str | None] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="doctor")
```

**`models/patient.py`**
```python
import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(16))
    contact_number: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(8))
    medical_history: Mapped[str | None] = mapped_column(Text)
    assigned_doctor: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="patient")
```

**`models/prediction.py`**
```python
import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    submitted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    original_image_path: Mapped[str | None] = mapped_column(String(512))
    report_image_path: Mapped[str | None] = mapped_column(String(512))
    report_pdf_path: Mapped[str | None] = mapped_column(String(512))
    top_prediction: Mapped[str] = mapped_column(String(128), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    all_probabilities: Mapped[dict] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    doctor_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="predictions")
    doctor = relationship("User", back_populates="predictions")
    feedback = relationship("Feedback", back_populates="prediction", uselist=False)
```

**`models/feedback.py`**
```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prediction_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("predictions.id"))
    submitted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    vote: Mapped[str] = mapped_column(String(8), nullable=False)   # 'up' | 'down'
    correct_label: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text)
    used_in_train: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    prediction = relationship("Prediction", back_populates="feedback")
```

**`models/model_version.py`**
```python
import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_tag: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    checkpoint_path: Mapped[str] = mapped_column(String(512), nullable=False)
    training_samples: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

**`models/audit_log.py`**
```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(64))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

---

### 4.5 `schemas/prediction.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PredictionClass(BaseModel):
    rank: int
    label: str
    confidence: float


class PatientInfoForReport(BaseModel):
    patient_id: str
    full_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None


class PredictionResponse(BaseModel):
    image_id: str
    patient: PatientInfoForReport
    top_prediction: str
    confidence: float
    description: str
    severity: str
    recommended_action: str
    icd_code: str
    all_classes: list[PredictionClass]
    model_version: str
    submitted_at: datetime
    report_url: str
    report_pdf_url: str
    disclaimer: str

    class Config:
        from_attributes = True


class FeedbackRequest(BaseModel):
    image_id: str
    vote: str = Field(..., pattern="^(up|down)$")
    correct_label: Optional[str] = None
    notes: Optional[str] = None
```

---

### 4.6 `services/model_utils.py`

```python
import numpy as np
from PIL import Image
import tensorflow as tf
import io
import os
from config import get_settings

settings = get_settings()

CLASS_NAMES = [
    "Eczema",
    "Melanoma",
    "Atopic Dermatitis",
    "Basal Cell Carcinoma",
    "Melanocytic Nevi",
    "BKL (Benign Keratosis-like Lesions)",
    "Psoriasis / Lichen Planus",
    "Seborrheic Keratoses",
    "Tinea / Fungal Infection",
    "Warts / Viral Infection",
]

CLASS_METADATA = {
    "Eczema": {
        "description": "A chronic inflammatory skin condition causing dry, itchy, and inflamed patches.",
        "severity": "Moderate",
        "action": "Prescribe topical corticosteroids. Schedule follow-up in 2 weeks.",
        "icd_code": "L20.9",
    },
    "Melanoma": {
        "description": "A malignant tumor of melanocytes — the most dangerous form of skin cancer.",
        "severity": "Critical",
        "action": "URGENT: Refer to oncology immediately. Biopsy required within 48 hours.",
        "icd_code": "C43.9",
    },
    "Atopic Dermatitis": {
        "description": "A chronic form of eczema common in children, causing intense itching.",
        "severity": "Moderate",
        "action": "Prescribe emollients and mild topical steroids. Allergen panel recommended.",
        "icd_code": "L20.0",
    },
    "Basal Cell Carcinoma": {
        "description": "The most common skin cancer. Slow-growing and rarely spreads.",
        "severity": "High",
        "action": "Refer to dermatology for excision. Non-urgent but within 4 weeks.",
        "icd_code": "C44.91",
    },
    "Melanocytic Nevi": {
        "description": "Common benign moles. Monitor for ABCDE changes.",
        "severity": "Low",
        "action": "Document and monitor. ABCDE rule check. Annual follow-up.",
        "icd_code": "D22.9",
    },
    "BKL (Benign Keratosis-like Lesions)": {
        "description": "Non-cancerous surface growths. Cosmetically bothersome but harmless.",
        "severity": "Low",
        "action": "Reassure patient. Cryotherapy if cosmetically bothersome.",
        "icd_code": "L82.1",
    },
    "Psoriasis / Lichen Planus": {
        "description": "Chronic autoimmune skin conditions causing scaly, itchy plaques.",
        "severity": "Moderate",
        "action": "Topical vitamin D analogues + corticosteroids. Refer to rheumatology if systemic.",
        "icd_code": "L40.0",
    },
    "Seborrheic Keratoses": {
        "description": "Harmless, waxy age-related skin growths. Very common in adults over 50.",
        "severity": "Low",
        "action": "No treatment required. Reassure patient. Removal optional.",
        "icd_code": "L82.1",
    },
    "Tinea / Fungal Infection": {
        "description": "Fungal skin infections including ringworm, tinea pedis, and tinea corporis.",
        "severity": "Moderate",
        "action": "Prescribe topical antifungals (clotrimazole). Culture swab recommended.",
        "icd_code": "B35.9",
    },
    "Warts / Viral Infection": {
        "description": "HPV-caused skin growths. Common in children and immunocompromised patients.",
        "severity": "Low",
        "action": "Cryotherapy or salicylic acid. HPV vaccination if not received.",
        "icd_code": "B07.9",
    },
}

_MODEL = None
_MODEL_VERSION = "v1"


def get_active_model_path() -> tuple[str, str]:
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    if os.path.exists(marker):
        with open(marker) as f:
            version = f.read().strip()
        path = os.path.join(settings.MODELS_DIR, f"model_{version}.keras")
        if os.path.exists(path):
            return path, version
    return settings.INITIAL_MODEL_PATH, "v1"


def load_model(force_reload: bool = False):
    global _MODEL, _MODEL_VERSION
    path, version = get_active_model_path()
    if _MODEL is None or force_reload or version != _MODEL_VERSION:
        print(f"[MODEL] Loading {version} from {path}")
        _MODEL = tf.keras.models.load_model(path)
        _MODEL_VERSION = version
        print(f"[MODEL] Loaded: {version}")
    return _MODEL, _MODEL_VERSION


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((settings.MODEL_INPUT_WIDTH, settings.MODEL_INPUT_HEIGHT))
    arr = np.asarray(img, dtype=np.float32)
    mean = arr.mean()
    std = arr.std() if arr.std() != 0 else 1.0
    arr = (arr - mean) / std
    return np.expand_dims(arr, axis=0)


def run_inference(image_bytes: bytes) -> dict:
    model, version = load_model()
    tensor = preprocess_image(image_bytes)
    probs = model.predict(tensor, verbose=0)[0]
    sorted_idx = np.argsort(probs)[::-1]
    top_idx = int(sorted_idx[0])
    top_label = CLASS_NAMES[top_idx]
    top_conf = float(probs[top_idx])
    meta = CLASS_METADATA[top_label]

    all_classes = [
        {"rank": i + 1, "label": CLASS_NAMES[idx], "confidence": round(float(probs[idx]) * 100, 2)}
        for i, idx in enumerate(sorted_idx)
    ]
    all_probs_dict = {CLASS_NAMES[i]: round(float(p) * 100, 4) for i, p in enumerate(probs)}

    return {
        "top_prediction":     top_label,
        "confidence":         round(top_conf * 100, 2),
        "description":        meta["description"],
        "severity":           meta["severity"],
        "recommended_action": meta["action"],
        "icd_code":           meta["icd_code"],
        "all_classes":        all_classes,
        "all_probabilities":  all_probs_dict,
        "model_version":      version,
    }
```

---

### 4.7 `services/report_generator.py`

Generates a professional annotated PNG with patient info, diagnosis, ICD-10 code, probability bar chart, and severity overlay — all stamped directly onto the image. Also produces an A4 PDF clinical report.

```python
"""
Annotated image layout:
┌────────────────────────────────────────────────────────┐
│  🏥 DermAI Diagnostic Report   Image ID: DA-XXXXXX     │  ← Header
│  Date: 2025-06-16 14:32 UTC                            │
├────────────────────────────────────────────────────────┤
│              [ ORIGINAL SKIN IMAGE ]                   │
├────────────────────────────────────────────────────────┤
│  PATIENT    John Doe           ID: HOSP-2025-00142     │  ← Patient strip
│  DOB        1985-04-12         Gender: Male  Blood: B+ │
├────────────────────────────────────────────────────────┤
│  ▲ CRITICAL   MELANOMA                   87.3% conf.   │  ← Diagnosis
│  ICD-10: C43.9                                         │
│  Action: URGENT — Refer to oncology. Biopsy 48h.      │
├────────────────────────────────────────────────────────┤
│  TOP 5 PROBABILITIES                                   │  ← Bar chart
│  Melanoma          ████████████████████ 87.3%         │
│  Basal Cell Carc.  ███ 6.1%                           │
│  Melanocytic Nevi  ██ 3.8%                            │
│  Seborrheic Ker.   █ 1.5%                             │
│  Eczema            █ 0.9%                             │
├────────────────────────────────────────────────────────┤
│  Model: ResNet50 v3  Submitted by: Dr. Sharma          │  ← Footer
│  ⚠  For clinical assistance only. Not a final DX.     │
└────────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Image as RLImage, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io
import os
from datetime import datetime
from config import get_settings

settings = get_settings()

C_BG_DARK  = (15,  23,  42)
C_BG_CARD  = (30,  41,  59)
C_BLUE     = (14, 165, 233)
C_GREEN    = (16, 185, 129)
C_YELLOW   = (234, 179,  8)
C_RED      = (239,  68, 68)
C_WHITE    = (241, 245, 249)
C_MUTED    = (148, 163, 184)
C_HEADER   = (7,   89, 133)

SEVERITY_COLORS = {
    "Low":      C_GREEN,
    "Moderate": C_YELLOW,
    "High":     (249, 115, 22),
    "Critical": C_RED,
}

CANVAS_WIDTH = 900
HEADER_H     = 80
PATIENT_H    = 100
DIAGNOSIS_H  = 110
CHART_H      = 170
FOOTER_H     = 60


def _load_font(size: int, bold: bool = False):
    font_name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for path in [
        f"/usr/share/fonts/truetype/dejavu/{font_name}",
        f"/usr/share/fonts/dejavu/{font_name}",
        f"/app/fonts/{font_name}",
    ]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _rect(draw, x0, y0, x1, y1, fill, radius=0):
    if radius:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill)
    else:
        draw.rectangle([x0, y0, x1, y1], fill=fill)


def generate_annotated_image(
    image_bytes: bytes,
    patient: dict,
    prediction: dict,
    image_id: str,
    doctor_name: str = "Unknown",
    department: str = "Dermatology",
) -> bytes:
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_w = CANVAS_WIDTH - 40
    img_h = int(img_w * orig.height / orig.width)
    orig_resized = orig.resize((img_w, img_h), Image.LANCZOS)
    total_h = HEADER_H + img_h + 20 + PATIENT_H + DIAGNOSIS_H + CHART_H + FOOTER_H

    canvas = Image.new("RGB", (CANVAS_WIDTH, total_h), C_BG_DARK)
    draw = ImageDraw.Draw(canvas)

    f_title = _load_font(22, bold=True)
    f_head  = _load_font(18, bold=True)
    f_sub   = _load_font(15)
    f_small = _load_font(12)
    f_label = _load_font(13, bold=True)

    y = 0
    # Header
    _rect(draw, 0, 0, CANVAS_WIDTH, HEADER_H, C_HEADER)
    draw.text((20, 10), "🏥 DermAI Diagnostic Report", font=f_title, fill=C_WHITE)
    draw.text((20, 46), f"Image ID: DA-{image_id[:8].upper()}", font=f_sub, fill=C_BLUE)
    draw.text((CANVAS_WIDTH - 280, 46),
              f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
              font=f_small, fill=C_MUTED)
    y = HEADER_H

    # Image
    canvas.paste(orig_resized, (20, y + 10))
    y += img_h + 20

    # Patient strip
    _rect(draw, 0, y, CANVAS_WIDTH, y + PATIENT_H, C_BG_CARD)
    draw.text((20, y + 10), "PATIENT INFORMATION", font=f_label, fill=C_BLUE)
    col2 = CANVAS_WIDTH // 2
    draw.text((20,   y + 35), f"Name:   {patient.get('full_name', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((20,   y + 60), f"ID:     {patient.get('patient_id', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 35), f"DOB:    {patient.get('date_of_birth', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 60),
              f"Gender: {patient.get('gender', 'N/A')}   Blood: {patient.get('blood_group', 'N/A')}",
              font=f_sub, fill=C_WHITE)
    y += PATIENT_H

    # Diagnosis
    sev = prediction.get("severity", "Low")
    sev_color = SEVERITY_COLORS.get(sev, C_GREEN)
    _rect(draw, 0, y, CANVAS_WIDTH, y + DIAGNOSIS_H, C_BG_DARK)
    _rect(draw, 20, y + 10, 140, y + 40, sev_color, radius=6)
    draw.text((28, y + 14), f"▲ {sev.upper()}", font=f_label, fill=C_BG_DARK)
    draw.text((155, y + 10), prediction.get("top_prediction", "N/A").upper(), font=f_head, fill=C_WHITE)
    draw.text((CANVAS_WIDTH - 200, y + 10),
              f"{prediction.get('confidence', 0):.1f}% confidence", font=f_sub, fill=sev_color)
    draw.text((20, y + 50), f"ICD-10: {prediction.get('icd_code', 'N/A')}", font=f_small, fill=C_MUTED)
    draw.text((20, y + 68), f"Action: {prediction.get('recommended_action', 'N/A')}", font=f_small, fill=C_WHITE)
    draw.text((20, y + 88),
              f"Description: {prediction.get('description', '')[:100]}", font=f_small, fill=C_MUTED)
    y += DIAGNOSIS_H

    # Probability chart
    _rect(draw, 0, y, CANVAS_WIDTH, y + CHART_H, C_BG_CARD)
    draw.text((20, y + 10), "TOP 5 PROBABILITY BREAKDOWN", font=f_label, fill=C_BLUE)
    bar_colors = [C_BLUE, (124, 58, 237), (249, 115, 22), C_MUTED, C_MUTED]
    bar_max_w = CANVAS_WIDTH - 340
    for i, cls in enumerate(prediction.get("all_classes", [])[:5]):
        by = y + 40 + i * 26
        draw.text((20, by), f"{i+1}.", font=f_small, fill=C_MUTED)
        draw.text((40, by), cls["label"][:30], font=f_small, fill=C_WHITE)
        bw = int((cls["confidence"] / 100) * bar_max_w)
        _rect(draw, 280, by + 2, 280 + bw, by + 16, bar_colors[i], radius=3)
        draw.text((290 + bw, by), f"{cls['confidence']:.1f}%", font=f_small, fill=C_MUTED)
    y += CHART_H

    # Footer
    _rect(draw, 0, y, CANVAS_WIDTH, y + FOOTER_H, C_HEADER)
    draw.text((20, y + 10),
              f"Model: ResNet50 {prediction.get('model_version', 'v1')} "
              f"| Submitted by: Dr. {doctor_name} | Dept: {department}",
              font=f_small, fill=C_WHITE)
    draw.text((20, y + 32),
              "⚠  AI-assisted report. Final diagnosis must be made by a licensed physician.",
              font=f_small, fill=C_YELLOW)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG", dpi=(300, 300))
    buf.seek(0)
    return buf.read()


def generate_pdf_report(
    annotated_image_path: str,
    patient: dict,
    prediction: dict,
    image_id: str,
    doctor_name: str = "Unknown",
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=18, textColor=colors.HexColor("#0EA5E9"))
    story.append(Paragraph("🏥 DermAI Hospital — Clinical AI Report", title_style))
    story.append(Spacer(1, 6*mm))

    data = [
        ["Image ID",      f"DA-{image_id[:8].upper()}",
         "Report Date",   datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Patient Name",  patient.get("full_name", "N/A"),
         "Patient ID",    patient.get("patient_id", "N/A")],
        ["DOB",           patient.get("date_of_birth", "N/A"),
         "Gender/Blood",  f"{patient.get('gender','N/A')} / {patient.get('blood_group','N/A')}"],
        ["Diagnosis",     prediction.get("top_prediction", "N/A"),
         "Confidence",    f"{prediction.get('confidence',0):.1f}%"],
        ["Severity",      prediction.get("severity", "N/A"),
         "ICD-10",        prediction.get("icd_code", "N/A")],
        ["Model Version", prediction.get("model_version", "v1"),
         "Submitted By",  f"Dr. {doctor_name}"],
    ]
    t = Table(data, colWidths=[35*mm, 60*mm, 35*mm, 50*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#0F172A")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#0F172A")),
        ("TEXTCOLOR",  (0, 0), (0, -1), colors.HexColor("#0EA5E9")),
        ("TEXTCOLOR",  (2, 0), (2, -1), colors.HexColor("#0EA5E9")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#1E293B")),
        ("BACKGROUND", (3, 0), (3, -1), colors.HexColor("#1E293B")),
        ("TEXTCOLOR",  (1, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    if os.path.exists(annotated_image_path):
        story.append(RLImage(annotated_image_path, width=180*mm, height=None))
    story.append(Spacer(1, 4*mm))

    action_style = ParagraphStyle("Action", parent=styles["Normal"], fontSize=9,
                                  backColor=colors.HexColor("#1E293B"),
                                  textColor=colors.HexColor("#F1F5F9"), borderPad=4)
    story.append(Paragraph(
        f"<b>Recommended Action:</b> {prediction.get('recommended_action', 'N/A')}",
        action_style))
    story.append(Spacer(1, 3*mm))

    disc_style = ParagraphStyle("Disc", parent=styles["Normal"],
                                fontSize=7, textColor=colors.HexColor("#94A3B8"))
    story.append(Paragraph(
        "⚠ This report is generated by an AI model (ResNet50) for clinical assistance only. "
        "It does not constitute a final medical diagnosis. All findings must be reviewed "
        "and confirmed by a licensed physician before clinical action is taken.",
        disc_style))
    doc.build(story)
    buf.seek(0)
    return buf.read()
```

---

### 4.8 `services/rlhf_engine.py`

```python
"""
RLHF feedback collection engine.

Flow:
  1. Doctor submits 👍 → vote=up stored in feedback table
  2. Doctor submits 👎 + correct_label → stored as ground-truth correction
  3. At midnight, retraining_worker calls collect_rlhf_dataset()
     which gathers all un-used feedback and returns image paths + labels
     ready for fine-tuning. Marks all collected rows as used_in_train=True.
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
```

---

### 4.9 `services/retraining_worker.py`

```python
"""
Celery beat task that fires every night at midnight UTC:
  1. Collects RLHF feedback samples
  2. Fine-tunes last 20 layers of ResNet50 for RETRAIN_EPOCHS
  3. Saves new versioned checkpoint
  4. Promotes if validation accuracy is acceptable
  5. Hot-swaps model in the running FastAPI process
  6. Logs result to model_versions table
"""

import os
import json
import shutil
import numpy as np
from datetime import datetime
import tensorflow as tf
from PIL import Image
from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import get_settings
from services.model_utils import CLASS_NAMES, load_model
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery("dermai_worker",
                    broker=settings.CELERY_BROKER_URL,
                    backend=settings.CELERY_RESULT_BACKEND)

celery_app.conf.beat_schedule = {
    "daily-retrain": {
        "task": "services.retraining_worker.daily_retrain_task",
        "schedule": crontab(hour=settings.RETRAIN_SCHEDULE_HOUR, minute=0),
    }
}
celery_app.conf.timezone = "UTC"


def _load_rlhf_samples(samples: list) -> tuple:
    X, y = [], []
    for s in samples:
        try:
            img = Image.open(s["image_path"]).convert("RGB")
            img = img.resize((settings.MODEL_INPUT_WIDTH, settings.MODEL_INPUT_HEIGHT))
            arr = np.asarray(img, dtype=np.float32)
            arr = (arr - arr.mean()) / (arr.std() or 1.0)
            idx = CLASS_NAMES.index(s["label"]) if s["label"] in CLASS_NAMES else -1
            if idx == -1:
                continue
            X.append(arr)
            y.append(idx)
        except Exception as e:
            logger.warning(f"Failed to load {s['image_path']}: {e}")
    if not X:
        return np.array([]), np.array([])
    X = np.array(X)
    y = tf.keras.utils.to_categorical(np.array(y), num_classes=len(CLASS_NAMES))
    return X, y


def _get_next_version_tag() -> str:
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    if os.path.exists(marker):
        with open(marker) as f:
            current = f.read().strip()
        return f"v{int(current[1:]) + 1}"
    return "v2"


def _promote_model(version_tag: str):
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    with open(marker, "w") as f:
        f.write(version_tag)
    logger.info(f"[RETRAIN] Promoted model: {version_tag}")


@celery_app.task(name="services.retraining_worker.daily_retrain_task", bind=True)
def daily_retrain_task(self, samples_json: str = None):
    """Main Celery retrain task. Triggered by beat at midnight or manually via /admin/trigger-retrain."""
    logger.info("[RETRAIN] Starting daily retraining task...")

    engine = create_engine(settings.DATABASE_SYNC_URL)
    Session = sessionmaker(bind=engine)

    if samples_json:
        samples = json.loads(samples_json)
    else:
        from models.feedback import Feedback
        from models.prediction import Prediction
        with Session() as session:
            rows = (
                session.query(Feedback, Prediction)
                .join(Prediction, Feedback.prediction_id == Prediction.id)
                .filter(Feedback.used_in_train == False)
                .all()
            )
            samples, ids_to_mark = [], []
            for fb, pred in rows:
                label = pred.top_prediction if fb.vote == "up" else fb.correct_label
                if not label or not pred.original_image_path:
                    continue
                dest_dir = os.path.join(settings.FEEDBACK_DS_DIR,
                                        label.replace("/", "_").replace(" ", "_"))
                os.makedirs(dest_dir, exist_ok=True)
                dest = os.path.join(dest_dir, f"{pred.image_id}.jpg")
                if os.path.exists(pred.original_image_path):
                    shutil.copy2(pred.original_image_path, dest)
                    samples.append({"image_path": dest, "label": label})
                    ids_to_mark.append(fb.id)
            if ids_to_mark:
                session.query(Feedback).filter(Feedback.id.in_(ids_to_mark))\
                    .update({"used_in_train": True}, synchronize_session=False)
                session.commit()

    if len(samples) < settings.MIN_FEEDBACK_SAMPLES_FOR_RETRAIN:
        logger.info(f"[RETRAIN] Only {len(samples)} samples — minimum {settings.MIN_FEEDBACK_SAMPLES_FOR_RETRAIN} required. Skipping.")
        return {"status": "skipped", "reason": "insufficient_samples", "count": len(samples)}

    X, y = _load_rlhf_samples(samples)
    if len(X) == 0:
        return {"status": "skipped", "reason": "no_valid_images"}

    model, _ = load_model()
    for layer in model.layers[-20:]:
        layer.trainable = True
    model.compile(
        optimizer=tf.keras.optimizers.SGD(learning_rate=0.0001, momentum=0.9),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    split = max(1, int(len(X) * 0.8))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    history = model.fit(
        X_train, y_train,
        epochs=settings.RETRAIN_EPOCHS,
        batch_size=settings.RETRAIN_BATCH_SIZE,
        validation_data=(X_val, y_val) if len(X_val) > 0 else None,
        verbose=1,
    )

    train_acc = float(history.history["accuracy"][-1])
    val_acc   = float(history.history.get("val_accuracy", [0])[-1]) if len(X_val) > 0 else None

    new_version = _get_next_version_tag()
    new_path = os.path.join(settings.MODELS_DIR, f"model_{new_version}.keras")
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
    model.save(new_path)

    promoted = False
    if val_acc is None or val_acc >= 0.5:
        _promote_model(new_version)
        load_model(force_reload=True)
        promoted = True

    from models.model_version import ModelVersion
    with Session() as session:
        session.query(ModelVersion).filter(ModelVersion.is_active == True)\
            .update({"is_active": False}, synchronize_session=False)
        mv = ModelVersion(
            version_tag=new_version,
            checkpoint_path=new_path,
            training_samples=len(X),
            accuracy=val_acc or train_acc,
            is_active=promoted,
            promoted_at=datetime.utcnow() if promoted else None,
        )
        session.add(mv)
        session.commit()

    return {
        "status": "success",
        "version": new_version,
        "promoted": promoted,
        "training_samples": len(X),
        "train_accuracy": round(train_acc * 100, 2),
        "val_accuracy": round(val_acc * 100, 2) if val_acc else None,
    }
```

---

### 4.10 `middleware/audit_logger.py`

```python
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    payload: dict | None = None,
    ip_address: str | None = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip_address,
        payload=payload,
    )
    db.add(entry)
    await db.commit()
```

---

## 5. API Routes

### 5.1 `routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

from database import get_db
from models.user import User
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(data: dict) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
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
    result = await db.execute(select(User).where(User.username == form.username))
    user = result.scalar_one_or_none()
    if not user or not pwd_ctx.verify(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer",
            "role": user.role, "full_name": user.full_name}
```

---

### 5.2 `routers/patients.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date

from database import get_db
from models.patient import Patient
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", status_code=201)
async def create_patient(
    full_name: str, gender: str = None, date_of_birth: str = None,
    contact_number: str = None, blood_group: str = None, medical_history: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_result = await db.execute(select(Patient))
    count = len(count_result.scalars().all()) + 1
    patient_id = f"HOSP-{date.today().year}-{count:05d}"

    patient = Patient(
        patient_id=patient_id, full_name=full_name, gender=gender,
        date_of_birth=date_of_birth, contact_number=contact_number,
        blood_group=blood_group, medical_history=medical_history,
        assigned_doctor=current_user.id,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/")
async def list_patients(db: AsyncSession = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Patient))
    return result.scalars().all()


@router.get("/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
```

---

### 5.3 `routers/predictions.py`

```python
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid, os, aiofiles

from database import get_db
from models.prediction import Prediction
from models.patient import Patient
from models.user import User
from services.model_utils import run_inference
from services.report_generator import generate_annotated_image, generate_pdf_report
from routers.auth import get_current_user
from middleware.audit_logger import log_action
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/predict", tags=["Predictions"])


@router.post("/", status_code=201)
async def predict_disease(
    patient_id: str = Form(...),
    file: UploadFile = File(...),
    doctor_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WEBP accepted.")
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 15 MB.")

    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    image_id = str(uuid.uuid4())
    os.makedirs(settings.IMAGES_DIR, exist_ok=True)
    img_path = os.path.join(settings.IMAGES_DIR, f"{image_id}.jpg")
    async with aiofiles.open(img_path, "wb") as f:
        await f.write(contents)

    try:
        inference = run_inference(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    patient_dict = {
        "full_name":    patient.full_name,
        "patient_id":   patient.patient_id,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else "N/A",
        "gender":       patient.gender or "N/A",
        "blood_group":  patient.blood_group or "N/A",
    }

    report_png = generate_annotated_image(
        image_bytes=contents, patient=patient_dict, prediction=inference,
        image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
        department=current_user.department or "Dermatology",
    )
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    report_img_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.png")
    async with aiofiles.open(report_img_path, "wb") as f:
        await f.write(report_png)

    pdf_bytes = generate_pdf_report(
        annotated_image_path=report_img_path, patient=patient_dict,
        prediction=inference, image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
    )
    report_pdf_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.pdf")
    async with aiofiles.open(report_pdf_path, "wb") as f:
        await f.write(pdf_bytes)

    pred_record = Prediction(
        image_id=image_id, patient_id=patient.id, submitted_by=current_user.id,
        original_image_path=img_path, report_image_path=report_img_path,
        report_pdf_path=report_pdf_path, top_prediction=inference["top_prediction"],
        confidence=inference["confidence"], all_probabilities=inference["all_probabilities"],
        model_version=inference["model_version"], doctor_notes=doctor_notes, status="pending",
    )
    db.add(pred_record)
    await db.commit()
    await db.refresh(pred_record)

    await log_action(db, current_user.id, "PREDICTION_CREATED", "prediction", pred_record.id,
                     {"image_id": image_id, "patient_id": patient_id,
                      "top_prediction": inference["top_prediction"]})

    base = f"{settings.API_BASE_URL}/reports/{image_id}"
    return {
        "image_id":           image_id,
        "patient":            patient_dict,
        "top_prediction":     inference["top_prediction"],
        "confidence":         inference["confidence"],
        "description":        inference["description"],
        "severity":           inference["severity"],
        "recommended_action": inference["recommended_action"],
        "icd_code":           inference["icd_code"],
        "all_classes":        inference["all_classes"],
        "model_version":      inference["model_version"],
        "submitted_at":       pred_record.created_at,
        "report_url":         f"{base}/image",
        "report_pdf_url":     f"{base}/pdf",
        "disclaimer": "⚠ AI-assisted diagnosis. Final interpretation by licensed physician required.",
    }


@router.get("/{image_id}")
async def get_prediction(image_id: str, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return pred
```

---

### 5.4 `routers/feedback.py`

```python
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
```

---

### 5.5 `routers/reports.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os

from database import get_db
from models.prediction import Prediction
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{image_id}/image")
async def get_report_image(image_id: str, db: AsyncSession = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_image_path or not os.path.exists(pred.report_image_path):
        raise HTTPException(status_code=404, detail="Report image not found")
    return FileResponse(pred.report_image_path, media_type="image/png",
                        filename=f"DermAI_Report_{image_id[:8]}.png")


@router.get("/{image_id}/pdf")
async def get_report_pdf(image_id: str, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_pdf_path or not os.path.exists(pred.report_pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not found")
    return FileResponse(pred.report_pdf_path, media_type="application/pdf",
                        filename=f"DermAI_ClinicalReport_{image_id[:8]}.pdf")
```

---

### 5.6 `routers/admin.py`

```python
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
        },
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
```

---

## 6. `app.py` — Main Application

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time

from config import get_settings
from database import create_all_tables
from services.model_utils import load_model
from routers import auth, patients, predictions, feedback, reports, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_all_tables()
    load_model()
    print(f"[STARTUP] {settings.APP_NAME} v{settings.APP_VERSION} ready.")
    yield
    print("[SHUTDOWN] Cleaning up...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Hospital-grade skin disease detection API with patient management, "
        "annotated image reports, RLHF feedback loop, and automated daily retraining."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.time() - start)*1000:.1f}ms"
    return response


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(predictions.router)
app.include_router(feedback.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    _, version = load_model()
    return {"status": "healthy", "active_model": version}
```

---

## 7. Dockerfile & Docker Compose

### `Dockerfile`

```dockerfile
FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 libpq-dev gcc \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/images /app/data/reports \
             /app/data/feedback_ds /app/data/models

COPY model_resnet50_klasifikasi.keras /app/data/models/model_v1.keras
RUN echo "v1" > /app/data/models/active_version.txt

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "2"]
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  api:
    build: .
    ports:
      - "7860:7860"
    environment:
      - DATABASE_URL=postgresql+asyncpg://dermuser:dermpass@db:5432/dermaidb
      - DATABASE_SYNC_URL=postgresql://dermuser:dermpass@db:5432/dermaidb
      - REDIS_URL=redis://redis:6379/0
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
      - SECRET_KEY=REPLACE_WITH_STRONG_256BIT_SECRET
      - API_BASE_URL=http://localhost:7860
      - ALLOWED_ORIGINS=["http://localhost:3000"]
    volumes:
      - ./data:/app/data
    depends_on:
      - db
      - redis
    restart: unless-stopped

  worker:
    build: .
    command: celery -A services.retraining_worker.celery_app worker --loglevel=info
    environment:
      - DATABASE_SYNC_URL=postgresql://dermuser:dermpass@db:5432/dermaidb
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    volumes:
      - ./data:/app/data
    depends_on:
      - db
      - redis
    restart: unless-stopped

  beat:
    build: .
    command: celery -A services.retraining_worker.celery_app beat --loglevel=info
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/1
    depends_on:
      - redis
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dermuser
      POSTGRES_PASSWORD: dermpass
      POSTGRES_DB: dermaidb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
```

**Start locally:**
```bash
docker compose up --build
# API docs: http://localhost:7860/docs
```

---

## 8. HuggingFace Deployment

HuggingFace Spaces (Docker SDK) does not natively host PostgreSQL or Redis. Use managed cloud services.

### Recommended Free Tier Services

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Supabase (supabase.com) | PostgreSQL | 500 MB |
| Neon (neon.tech) | PostgreSQL | 3 GB |
| Upstash (upstash.com) | Redis | 10,000 req/day |

### Step-by-step

**8.1 — Create HuggingFace account** at https://huggingface.co

**8.2 — Create a New Space**
- Profile → New Space
- Name: `dermai-hospital-api`
- SDK: **Docker**
- Visibility: **Public**

**8.3 — Add Secrets** (Space → Settings → Secrets)
```
DATABASE_URL        postgresql+asyncpg://user:pass@db.supabase.co:5432/dermaidb
DATABASE_SYNC_URL   postgresql://user:pass@db.supabase.co:5432/dermaidb
REDIS_URL           redis://default:pass@host.upstash.io:6379
CELERY_BROKER_URL   redis://default:pass@host.upstash.io:6379
CELERY_RESULT_BACKEND redis://default:pass@host.upstash.io:6380
SECRET_KEY          <your-256-bit-random-secret>
API_BASE_URL        https://YOUR_USERNAME-dermai-hospital-api.hf.space
ALLOWED_ORIGINS     ["https://your-app.vercel.app"]
```

**8.4 — Push code via Git LFS** (required for the .keras model file)
```bash
git lfs install

git clone https://huggingface.co/spaces/YOUR_USERNAME/dermai-hospital-api
cd dermai-hospital-api

git lfs track "*.keras"
git add .gitattributes

# Copy all project files here
cp -r /path/to/your/project/* .

git add .
git commit -m "DermAI Hospital v2 initial deployment"
git push
```

**8.5 — Wait for build** (~5–10 min). Watch "Logs" tab in HuggingFace.

**8.6 — Test the deployment**
```bash
# Health check
curl https://YOUR_USERNAME-dermai-hospital-api.hf.space/health

# Register first admin user
curl -X POST "https://YOUR_USERNAME-dermai-hospital-api.hf.space/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@hospital.com","password":"admin123","role":"admin"}'
```

**8.7 — Test predict endpoint via Swagger** at `/docs`

### `README.md` for HuggingFace Space

```markdown
---
title: DermAI Hospital Backend
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: mit
---

# DermAI Hospital API v2

Hospital-grade skin disease detection with patient management, annotated reports, and RLHF daily retraining.

**Base URL:** `https://YOUR_USERNAME-dermai-hospital-api.hf.space`  
**Swagger:** `/docs`

Routes: `/auth` · `/patients` · `/predict` · `/feedback` · `/reports` · `/admin`
```

---

## 9. Frontend Prompt (Lovable / v0)

Copy the **entire block** below into [Lovable](https://lovable.dev) or [v0](https://v0.dev):

---

```
Build a full hospital management web application called "DermAI Hospital" — a clinical AI-powered skin disease detection system for doctors. This is a professional, secure, multi-page React app deployed on Vercel. Do NOT make this look like a consumer app — it must look and feel like enterprise hospital software.

─────────────────────────────────────────
TECH STACK
─────────────────────────────────────────
React 18 + TypeScript + Vite
Tailwind CSS + shadcn/ui
React Query (TanStack Query v5) for all API calls
React Router v6 for routing
Framer Motion for animations
React Hook Form + Zod for all forms
Axios for HTTP with JWT interceptors
Sonner for toast notifications
Recharts for analytics charts

Environment variable:
  VITE_API_URL=https://YOUR_USERNAME-dermai-hospital-api.hf.space

─────────────────────────────────────────
DESIGN SYSTEM — HOSPITAL DARK THEME
─────────────────────────────────────────
Background:  #0F172A (slate-900)
Card:        #1E293B (slate-800)
Border:      #334155 (slate-700)
Primary:     #0EA5E9 (sky-500)
Success:     #10B981 (emerald-500)
Warning:     #F59E0B (amber-500)
Danger:      #EF4444 (red-500)
Critical:    #DC2626 (red-600) with pulsing red glow animation
Text:        #F1F5F9 (slate-100)
Muted:       #94A3B8 (slate-400)

Severity colors used CONSISTENTLY everywhere:
  Low:      emerald-500
  Moderate: amber-500
  High:     orange-500
  Critical: red-600 + pulsing box-shadow animation

Font: Inter (Google Fonts), monospace for IDs and codes.
Corner radius: 8px cards, 6px buttons.
No rounded-full on severity badges — use rounded-md for clinical look.
Subtle grid/dot background pattern on main pages.

─────────────────────────────────────────
AUTH SYSTEM
─────────────────────────────────────────
AuthContext that:
- Stores JWT token in React context only (NOT localStorage)
- Has login(), logout(), user object, isAuthenticated, role
- Attaches Authorization: Bearer header to every Axios request
- Redirects to /login on 401
- Shows role badge (Doctor / Admin) in sidebar

Login Page (/login):
- Full-screen dark layout with hospital logo "🏥 DermAI Hospital"
- Form: Username + Password
- Submit button: "Login"
- Error message on failure
- On success → redirect to /dashboard

─────────────────────────────────────────
PAGES & ROUTING
─────────────────────────────────────────
Public:
  /login             → Login page

Protected (doctor + admin):
  /dashboard         → Overview stats + recent activity
  /patients          → Patient registry + registration drawer
  /patients/:id      → Patient detail + scan history
  /scan              → New scan submission page
  /scan/:image_id    → Full scan result detail page

Admin only:
  /admin             → Admin panel
  /admin/audit       → Audit log viewer

─────────────────────────────────────────
PAGE 1: DASHBOARD (/dashboard)
─────────────────────────────────────────
4 stat cards in a row:
  - Total Scans Today (count from today)
  - Total Patients Registered
  - RLHF Accuracy Signal (% of 👍 votes, from /admin/dashboard)
  - Active Model Version (e.g. "ResNet50 v3")

Quick Action cards (2 large):
  "🔬 New Skin Scan →" → /scan
  "👤 Register Patient →" → /patients

Recent Activity Table (last 10 scans by this doctor):
  Columns: Image ID | Patient Name | Diagnosis | Confidence | Severity badge | Date | Actions
  Actions: "View" button → /scan/:image_id
           👍/👎 feedback buttons inline if feedback not yet given

Severity Distribution Pie Chart (Recharts):
  Shows Low / Moderate / High / Critical breakdown of recent scans

─────────────────────────────────────────
PAGE 2: PATIENTS (/patients)
─────────────────────────────────────────
Header: "Patient Registry" + "Register New Patient" button (opens slide-over drawer)

Patient Registration Drawer (slide-over from right):
  Fields:
    Full Name* (text)
    Date of Birth* (date)
    Gender* (select: Male / Female / Other)
    Blood Group (select: A+, A-, B+, B-, O+, O-, AB+, AB-)
    Contact Number (tel)
    Medical History (textarea)
  Submit → POST /patients/
  On success: show generated Patient ID (HOSP-YYYY-NNNNN) in toast with copy button

Patient Table (searchable, sortable, paginated 20/page):
  Columns: Patient ID | Full Name | DOB | Gender | Blood Group | Scan Count | Last Scan | Actions
  Real-time search by name or patient ID
  "View" → /patients/:id
  "New Scan" → /scan with pre-filled patient ID

─────────────────────────────────────────
PAGE 3: NEW SCAN (/scan)
─────────────────────────────────────────
Two-column layout (stacks vertically on mobile).

LEFT PANEL — Input:
  Step 1 — Select Patient:
    Search-as-you-type input: find patient by name or ID
    Autocomplete dropdown: ID | Name | DOB
    Selected patient chip shown below with remove (×)
    Link: "+ Register New Patient"

  Step 2 — Upload Image:
    Drag-and-drop zone (react-dropzone)
    Icon: camera icon + "Drag skin image here or click to browse"
    Accepted: JPG, PNG, WEBP — Max 15 MB
    On select: show image preview (aspect-ratio preserved, rounded corners)
    Show filename + file size

  Step 3 — Doctor Notes (optional):
    Textarea: "Add clinical observations..."

  "Run AI Analysis" button (full width, primary color)
    Disabled until patient + image selected
    Shows spinner + "Analyzing..." during API call

RIGHT PANEL — Results:

  State 1 — Empty:
    Large 🔬 emoji, "Upload a skin image to begin AI analysis"
    Dashed border card, muted text

  State 2 — Loading:
    Skeleton loaders + animated step indicators:
    ✓ Image received → ✓ Preprocessing → ● Running ResNet50 → ○ Generating Report

  State 3 — Results:
    TOP DIAGNOSIS CARD:
      Severity badge (colored, Critical = pulsing red glow)
      Disease name in large bold text
      Animated circular confidence gauge (SVG arc)
        Color: green >80%, amber 50–80%, red <50%
        Center shows "87.3%" in large text
      ICD-10 code (monospace)
      Disease description text
      Amber "Recommended Action" box with action text from API

    PROBABILITY BREAKDOWN:
      Title: "Full AI Probability Analysis"
      Table: Rank | Disease | Animated bar | Confidence %
      Bar colors: rank 1 = sky-500, rank 2 = violet, rest = slate
      Bars animate from 0 to final width on mount

    REPORT SECTION:
      Two buttons:
        "🖼 View Annotated Image" → opens full-screen modal
        "📄 Download PDF Report" → downloads PDF
      Thumbnail preview of the annotated report image

    FEEDBACK SECTION (critical for RLHF):
      Card with title: "Was this AI prediction correct?"
      Subtitle: "Your feedback trains tomorrow's model"
      Two large buttons:
        👍 CORRECT (emerald, full width half)
        👎 INCORRECT (red, full width half)
      On 👎 click: show mini-form asking for correct label (dropdown of 10 classes) + optional notes
      On submit: POST /feedback/ → toast: "Thank you! Feedback saved for tonight's retraining."
      Disable both buttons after submission, show confirmation state

  State 4 — Error:
    Red card with error icon + message
    "Try Again" button resets the form

─────────────────────────────────────────
PAGE 4: SCAN RESULT (/scan/:image_id)
─────────────────────────────────────────
Full-page version of the results panel.
Shows:
  Patient info header card (name, ID, DOB, blood group, assigned doctor)
  Full diagnosis panel (same as above)
  Annotated image viewer inline
  PDF download button
  Feedback section (if not already given)
  Doctor Notes (editable textarea, save button → PATCH)
  Breadcrumb: Dashboard > Patients > {patient name} > Scan {image_id[:8]}

─────────────────────────────────────────
PAGE 5: PATIENT DETAIL (/patients/:id)
─────────────────────────────────────────
Top section: Patient info card with all fields
"New Scan for this Patient" CTA button

Scan History table (sorted by date desc):
  Columns: Image ID | Date | Diagnosis | Confidence | Severity | Feedback | View
  Feedback column: 👍 / 👎 / — (not given)
  Color-coded severity badges

─────────────────────────────────────────
PAGE 6: ADMIN PANEL (/admin) — Admin only
─────────────────────────────────────────
4 stat cards:
  Total Predictions | Total Patients | RLHF Accuracy Signal | Pending Feedback Samples

Model Performance Table:
  Columns: Version | Training Samples | Accuracy | Status (Active/Previous) | Promoted At
  "Trigger Manual Retrain" button → POST /admin/trigger-retrain → toast "Retrain queued!"

Feedback Signal Line Chart (Recharts):
  X-axis: last 14 days
  Y-axis: RLHF accuracy % (👍 ratio)
  Shows model correctness trend over time

─────────────────────────────────────────
GLOBAL COMPONENTS
─────────────────────────────────────────
1. Sidebar Navigation (collapsible to icon-only):
   Logo: "🏥 DermAI Hospital" in bold + "BETA" badge
   Nav items with icons:
     📊 Dashboard
     👥 Patients
     🔬 New Scan
     🔐 Admin (admin only)
   Bottom: Doctor avatar + full name + role badge + "Logout" button
   Mobile: sidebar collapses to bottom tab bar

2. SeverityBadge:
   Props: { severity: "Low"|"Moderate"|"High"|"Critical" }
   Critical: pulsing red box-shadow animation
   Consistent everywhere in app

3. ConfidenceGauge:
   Animated SVG radial arc gauge
   Center: large percentage text
   Arc color: green/amber/red by value

4. ImageReportModal:
   Full-screen overlay showing annotated PNG
   Zoom in/out controls
   Download button
   Close (×) button

5. FeedbackWidget:
   👍/👎 with state management
   Shows submitting spinner
   Shows success/already-submitted states
   Reusable across dashboard and scan result pages

─────────────────────────────────────────
API INTEGRATION
─────────────────────────────────────────
Create api/client.ts:

import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach JWT
api.interceptors.request.use(config => {
  const token = window.__authToken;  // set from AuthContext
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) window.location.href = '/login';
    return Promise.reject(err);
  }
);

export default api;

API hooks to create (React Query):
  useLogin()             → POST /auth/login
  useCreatePatient()     → POST /patients/
  usePatients()          → GET /patients/
  usePatient(id)         → GET /patients/{id}
  useCreatePrediction()  → POST /predict/ (multipart/form-data)
  usePrediction(imageId) → GET /predict/{image_id}
  useSubmitFeedback()    → POST /feedback/
  useAdminDashboard()    → GET /admin/dashboard
  useModelVersions()     → GET /admin/model-versions
  useTriggerRetrain()    → POST /admin/trigger-retrain

─────────────────────────────────────────
ADDITIONAL REQUIREMENTS
─────────────────────────────────────────
- All IDs (Patient ID, Image ID) shown in monospace with one-click copy button
- Breadcrumb navigation on every page
- Loading skeletons for every data-fetching state
- Empty states with CTA ("No patients yet — Register First Patient")
- Confirmation dialogs before any destructive action
- Toast notifications for all API success/error responses
- vercel.json for SPA routing: {"rewrites": [{"source": "/(.*)", "destination": "/"}]}
- Error boundary wrapper for production resilience
- Each page title: "DermAI Hospital | {Page Name}"
- Footer: © 2025 DermAI Hospital · AI-Assisted Clinical Tool · Not a Substitute for Medical Advice

Generate all pages, components, hooks, types, and full routing. Production-deployable to Vercel with VITE_API_URL env var.
```

---

## 10. Vercel Deployment

**10.1 — Export to GitHub**
- Lovable: Click "Publish to GitHub"
- v0: Click "Open in StackBlitz" → push to GitHub

**10.2 — Connect Vercel**
1. https://vercel.com → "Add New Project"
2. Import your GitHub repository
3. Framework: **Vite** (auto-detected)

**10.3 — Set Environment Variable**

| Name | Value | Environments |
|------|-------|-------------|
| `VITE_API_URL` | `https://YOUR_USERNAME-dermai-hospital-api.hf.space` | Production, Preview, Development |

**10.4 — Create `vercel.json`** in project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

**10.5 — Deploy**
Click "Deploy". Live in ~2 minutes at `https://your-project.vercel.app`

---

## 11. Environment Variables Reference

### Backend `.env`

```env
APP_NAME=DermAI Hospital API
APP_VERSION=2.0.0
DEBUG=false
ALLOWED_ORIGINS=["https://your-app.vercel.app"]
API_BASE_URL=https://YOUR_USERNAME-dermai-hospital-api.hf.space

DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dermaidb
DATABASE_SYNC_URL=postgresql://user:pass@host:5432/dermaidb

REDIS_URL=redis://default:password@host.upstash.io:6379
CELERY_BROKER_URL=redis://default:password@host.upstash.io:6379
CELERY_RESULT_BACKEND=redis://default:password@host.upstash.io:6380

SECRET_KEY=YOUR_256_BIT_RANDOM_SECRET_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

DATA_DIR=/app/data
IMAGES_DIR=/app/data/images
REPORTS_DIR=/app/data/reports
FEEDBACK_DS_DIR=/app/data/feedback_ds
MODELS_DIR=/app/data/models
INITIAL_MODEL_PATH=/app/data/models/model_v1.keras

MODEL_INPUT_WIDTH=100
MODEL_INPUT_HEIGHT=75

MIN_FEEDBACK_SAMPLES_FOR_RETRAIN=20
RETRAIN_EPOCHS=3
RETRAIN_BATCH_SIZE=16
RETRAIN_SCHEDULE_HOUR=0
```

### Frontend (Vercel Dashboard)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR_USERNAME-dermai-hospital-api.hf.space` |

---

## 12. End-to-End Flow Diagram

```
DOCTOR LOGIN
    │  POST /auth/login → JWT token (8h validity)
    ▼
REGISTER PATIENT
    │  POST /patients/ → patient_id: "HOSP-2025-00001"
    ▼
UPLOAD SKIN IMAGE + patient_id
    │  POST /predict/ (multipart: file + patient_id + notes)
    │
    ├─ Save raw image → /data/images/{uuid}.jpg
    │
    ├─ ResNet50 Inference → 10-class softmax probabilities
    │
    ├─ report_generator.py
    │    → PIL: Header + Patient info + Diagnosis + Severity +
    │           ICD-10 + Action + Probability bars + Footer
    │    → PNG saved → /data/reports/{uuid}_report.png
    │    → PDF saved → /data/reports/{uuid}_report.pdf
    │
    ├─ Persist Prediction + image paths to PostgreSQL
    ├─ Audit log entry created
    │
    │  ← JSON: {image_id, top_prediction, confidence, severity,
    │           icd_code, recommended_action, all_classes,
    │           report_url, report_pdf_url, ...}
    ▼
DOCTOR VIEWS REPORT
    │  GET /reports/{image_id}/image  ← annotated PNG
    │  GET /reports/{image_id}/pdf    ← A4 clinical PDF
    ▼
DOCTOR GIVES FEEDBACK (RLHF)
    │  POST /feedback/ {image_id, vote: "up"|"down", correct_label?}
    │  ← Stored in feedback table, prediction status → "reviewed"
    ▼
─────────────── 00:00 UTC MIDNIGHT ──────────────
CELERY BEAT fires daily_retrain_task
    │
    ├─ Collect all unused 👍/👎 feedback + images
    ├─ Build X_train / y_train numpy arrays
    ├─ Fine-tune ResNet50 (last 20 layers, 3 epochs)
    ├─ Save → /data/models/model_v{N+1}.keras
    ├─ If val_acc acceptable → update active_version.txt
    ├─ load_model(force_reload=True) → hot-swap in live process
    └─ Log to model_versions table + mark feedback as used_in_train=True
─────────────────────────────────────────────────
```

---

## 13. Deployment Checklist

### Backend

- [ ] `model_resnet50_klasifikasi.keras` copied to `data/models/model_v1.keras`
- [ ] `echo "v1" > data/models/active_version.txt`
- [ ] Supabase (or Neon) PostgreSQL project created → `DATABASE_URL` copied
- [ ] Upstash Redis created → `REDIS_URL` copied
- [ ] All secrets added to HuggingFace Space → Settings → Repository Secrets
- [ ] Code pushed via Git LFS (`*.keras` tracked)
- [ ] HuggingFace Space shows **"Running"** status
- [ ] `POST /auth/register` — first admin user created
- [ ] `GET /health` returns `{"status":"healthy","active_model":"v1"}`
- [ ] `GET /docs` — Swagger UI loads
- [ ] Test via Swagger: register → patient → predict → feedback
- [ ] `GET /reports/{image_id}/image` — annotated PNG downloads correctly
- [ ] `GET /reports/{image_id}/pdf` — A4 PDF downloads correctly

### Frontend

- [ ] Lovable/v0 prompt pasted → full app generated
- [ ] `VITE_API_URL` set to your HuggingFace Space URL
- [ ] Code exported to GitHub repository
- [ ] Vercel project connected to GitHub
- [ ] `VITE_API_URL` env var set in Vercel dashboard
- [ ] `vercel.json` present in repo root
- [ ] Vercel deployment successful — live URL confirmed
- [ ] End-to-end test: login → register patient → upload scan → view report → give feedback 👍

### Operational

- [ ] Celery worker + beat containers running (check Docker Compose logs)
- [ ] Test manual retrain: `POST /admin/trigger-retrain`
- [ ] Confirm `model_versions` table receives new entry after retrain
- [ ] RLHF accuracy signal visible in admin dashboard
- [ ] Midnight schedule confirmed in Celery beat logs

---

## 14. Robustness & Production Hardening Notes

### Security
- JWT with 8-hour expiry matching a hospital shift
- Role-based access: `doctor` sees only their patients; `admin` sees everything
- Audit log on every write action (who, what, when, IP)
- CORS locked to your Vercel domain in production (`ALLOWED_ORIGINS`)
- Password hashing via bcrypt (passlib)

### Data Integrity
- Unique `image_id` UUID per scan — printed on every report, used as the RLHF key
- Immutable prediction records — no updates (only `doctor_notes` and `status` change)
- Feedback deduplication — one doctor, one vote per image (409 on duplicate)
- `used_in_train` flag ensures no sample is trained on twice

### Report Quality
- Annotated PNG: original image + patient strip + diagnosis overlay + ICD-10 + probability bars
- A4 PDF: suitable for printing and adding to patient's physical file
- ICD-10 codes included for insurance/billing compatibility
- Severity color coding consistent across image overlay and frontend UI

### RLHF Loop
- 👍 → confirms prediction → image+label added to positive training pool
- 👎 → doctor provides correct label → corrected sample used for supervised fine-tuning
- Minimum sample threshold (default 20) prevents retraining on tiny noisy batches
- Model only promoted if validation accuracy is acceptable (≥ 50%)
- Hot-swap: new model loads in-process without API restart

### Observability
- `/health` endpoint reports active model version
- `X-Process-Time` header on every response for latency monitoring
- Admin dashboard: total predictions, RLHF accuracy signal, pending retrain samples
- Full model version history with accuracy and promotion timestamp
- Audit logs queryable by admin at `/admin/audit-logs`

### Scalability Notes
- `pool_size=10, max_overflow=20` on the async DB engine handles concurrent hospital use
- Celery worker scales horizontally (add more `worker` containers as load grows)
- HuggingFace persistent volume (`/app/data`) persists images, reports, and model checkpoints across restarts
- Migrate to AWS S3 / Google Cloud Storage for `/app/data` when volume exceeds disk limits

---

*DermAI Hospital v2 — ResNet50 · FastAPI · PostgreSQL · Redis · Celery · React · HuggingFace · Vercel*
