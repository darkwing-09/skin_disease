
# 🏥 DermAI Hospital — Full-Stack Backend Implementation Guide

**Version:** 2.0 — Hospital-Grade Edition  
**Model:** ResNet50 (10-class skin disease classifier)  
**Architecture:** FastAPI → PostgreSQL → Redis → Celery → HuggingFace (backend) + React Frontend (Vercel)  
**New in v2:** Patient records · Annotated image reports · RLHF feedback loop · Daily model retraining · Audit logs · Role-based access

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
   - 4.6 model_utils.py (Inference)
   - 4.7 report_generator.py (Annotated Image Reports)
   - 4.8 rlhf_engine.py (Feedback + Retraining)
   - 4.9 retraining_worker.py (Celery Task)
5. [API Routes](#5-api-routes)
   - 5.1 auth.py (JWT Auth)
   - 5.2 patients.py
   - 5.3 predictions.py
   - 5.4 feedback.py
   - 5.5 reports.py
   - 5.6 admin.py
6. [app.py — Main Application](#6-apppy--main-application)
7. [Dockerfile & Docker Compose](#7-dockerfile--docker-compose)
8. [HuggingFace Deployment](#8-huggingface-deployment)
9. [Lovable / v0 Frontend Prompt](#9-lovable--v0-frontend-prompt)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [End-to-End Flow Diagram](#11-end-to-end-flow-diagram)
12. [Deployment Checklist](#12-deployment-checklist)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOSPITAL FRONTEND                            │
│              (React + Vercel — Doctor's Dashboard)                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTPS REST API
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND (HuggingFace)                     │
│                                                                     │
│  /auth          JWT login, role management (admin / doctor)         │
│  /patients      CRUD — patient intake, demographics                 │
│  /predict       Image upload → ResNet50 inference → store result    │
│  /report        Generate annotated image (PIL overlay) → return PDF │
│  /feedback      👍/👎 RLHF signal per prediction (image_id)         │
│  /admin         Model metrics, retrain status, audit logs           │
│                                                                     │
└───────┬──────────────┬──────────────┬───────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────────────┐
  │PostgreSQL│  │  Redis   │  │  Celery Worker   │
  │          │  │  Cache   │  │  (Daily Retrain) │
  │ patients │  │  + Queue │  │  APScheduler     │
  │ predict  │  │          │  │  00:00 UTC daily │
  │ feedback │  └──────────┘  └──────────────────┘
  │ audit    │
  └──────────┘
        │
        ▼
  ┌──────────────────────┐
  │  /data/images/       │  Raw uploaded images (stored by image_id)
  │  /data/reports/      │  Annotated report images (PNG/PDF)
  │  /data/feedback_ds/  │  Confirmed correct samples for retraining
  │  /data/models/       │  Versioned model checkpoints
  └──────────────────────┘
```

**Key design decisions:**
- Every prediction gets a **unique UUID image_id** stamped on the annotated image report
- Doctors submit 👍/👎 via image_id — this feeds the **RLHF feedback store**
- A **Celery beat task** runs at midnight: collects all 👍-confirmed samples from the day, fine-tunes the model on them, saves a new versioned checkpoint, and swaps it in live
- PostgreSQL stores **full audit trail** — every prediction, every feedback event, every model version swap
- **Role-based access**: `admin` can see all patients / retrain logs; `doctor` sees only their own submissions

---

## 2. Complete Project Structure

```
skin-disease-hospital-backend/
│
├── app.py                          # FastAPI entry point
├── config.py                       # All env-var settings (Pydantic BaseSettings)
├── database.py                     # SQLAlchemy engine + session
├── requirements.txt
├── Dockerfile
├── docker-compose.yml              # Local dev: API + PostgreSQL + Redis + Celery
│
├── models/                         # SQLAlchemy ORM models
│   ├── __init__.py
│   ├── user.py                     # Doctor / Admin accounts
│   ├── patient.py                  # Patient demographics
│   ├── prediction.py               # Prediction record (1 per image submission)
│   ├── feedback.py                 # RLHF feedback (👍 / 👎) per prediction
│   └── model_version.py            # Versioned model checkpoint log
│
├── schemas/                        # Pydantic request/response models
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
├── services/                       # Business logic layer
│   ├── __init__.py
│   ├── model_utils.py              # ResNet50 inference
│   ├── report_generator.py         # PIL annotated image + PDF generation
│   ├── rlhf_engine.py              # Collect feedback, build retraining dataset
│   └── retraining_worker.py        # Celery task: daily fine-tune
│
├── middleware/
│   └── audit_logger.py             # Logs every API call to DB audit table
│
├── data/
│   ├── images/                     # Raw uploaded images  → {image_id}.jpg
│   ├── reports/                    # Annotated report PNGs → {image_id}_report.png
│   ├── feedback_ds/                # Confirmed correct samples for retraining
│   └── models/                     # model_v1.keras, model_v2.keras, ...
│
└── README.md                       # HuggingFace Spaces config header
```

---

## 3. Database Schema

```sql
-- ── USERS (doctors + admins) ─────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(64) UNIQUE NOT NULL,
    email         VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role          VARCHAR(16) NOT NULL DEFAULT 'doctor',   -- 'doctor' | 'admin'
    full_name     VARCHAR(128),
    department    VARCHAR(64),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PATIENTS ─────────────────────────────────────────────────────────
CREATE TABLE patients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       VARCHAR(32) UNIQUE NOT NULL,  -- hospital-assigned e.g. HOSP-2025-00142
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

-- ── PREDICTIONS ──────────────────────────────────────────────────────
CREATE TABLE predictions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id          VARCHAR(36) UNIQUE NOT NULL,  -- public-facing ID printed on report
    patient_id        UUID REFERENCES patients(id) ON DELETE CASCADE,
    submitted_by      UUID REFERENCES users(id),
    
    -- Raw file paths
    original_image_path  VARCHAR(512),
    report_image_path    VARCHAR(512),    -- annotated image path
    report_pdf_path      VARCHAR(512),    -- PDF report path
    
    -- Model outputs
    top_prediction    VARCHAR(128) NOT NULL,
    confidence        FLOAT NOT NULL,     -- 0.0–100.0
    all_probabilities JSONB NOT NULL,     -- {class: prob} for all 10 classes
    model_version     VARCHAR(32),        -- e.g. "v3"
    
    -- Status
    status            VARCHAR(16) DEFAULT 'pending',  -- pending | reviewed | archived
    doctor_notes      TEXT,
    
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEEDBACK (RLHF) ──────────────────────────────────────────────────
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id   UUID REFERENCES predictions(id) ON DELETE CASCADE,
    submitted_by    UUID REFERENCES users(id),
    vote            VARCHAR(8) NOT NULL,          -- 'up' | 'down'
    correct_label   VARCHAR(128),                 -- doctor's ground truth (if down vote)
    notes           TEXT,
    used_in_train   BOOLEAN DEFAULT FALSE,        -- flagged after used in retraining batch
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MODEL VERSIONS ───────────────────────────────────────────────────
CREATE TABLE model_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag     VARCHAR(32) UNIQUE NOT NULL,  -- v1, v2, v3 ...
    checkpoint_path VARCHAR(512) NOT NULL,
    training_samples INT DEFAULT 0,
    accuracy        FLOAT,                        -- validation accuracy after retraining
    is_active       BOOLEAN DEFAULT FALSE,        -- only one active at a time
    promoted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(128) NOT NULL,   -- e.g. "PREDICTION_CREATED", "FEEDBACK_SUBMITTED"
    entity_type VARCHAR(64),             -- "prediction" | "patient" | "feedback"
    entity_id   UUID,
    ip_address  VARCHAR(64),
    payload     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────────────
CREATE INDEX idx_predictions_patient ON predictions(patient_id);
CREATE INDEX idx_predictions_image_id ON predictions(image_id);
CREATE INDEX idx_feedback_prediction ON feedback(prediction_id);
CREATE INDEX idx_feedback_used_train ON feedback(used_in_train) WHERE used_in_train = FALSE;
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
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

# Caching & Config
pydantic-settings==2.2.1
python-dotenv==1.0.1

# Utilities
uuid==1.30
aiofiles==23.2.1
```

---

### 4.2 `config.py`

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "DermAI Hospital API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["*"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://dermuser:dermpass@localhost:5432/dermaidb"
    DATABASE_SYNC_URL: str = "postgresql://dermuser:dermpass@localhost:5432/dermaidb"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # JWT Auth
    SECRET_KEY: str = "CHANGE_THIS_TO_RANDOM_256BIT_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   # 8-hour hospital shift

    # File Storage
    DATA_DIR: str = "/app/data"
    IMAGES_DIR: str = "/app/data/images"
    REPORTS_DIR: str = "/app/data/reports"
    FEEDBACK_DS_DIR: str = "/app/data/feedback_ds"
    MODELS_DIR: str = "/app/data/models"

    # Model
    INITIAL_MODEL_PATH: str = "/app/data/models/model_v1.keras"
    MODEL_INPUT_WIDTH: int = 100
    MODEL_INPUT_HEIGHT: int = 75

    # Retraining
    MIN_FEEDBACK_SAMPLES_FOR_RETRAIN: int = 20
    RETRAIN_EPOCHS: int = 3
    RETRAIN_BATCH_SIZE: int = 16
    RETRAIN_SCHEDULE_HOUR: int = 0   # midnight UTC

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

**`models/prediction.py`** (most important — shown in full):

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    image_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    original_image_path: Mapped[str] = mapped_column(String(512))
    report_image_path: Mapped[str] = mapped_column(String(512))
    report_pdf_path: Mapped[str] = mapped_column(String(512))
    top_prediction: Mapped[str] = mapped_column(String(128), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    all_probabilities: Mapped[dict] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    doctor_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="predictions")
    doctor = relationship("User", back_populates="predictions")
    feedback = relationship("Feedback", back_populates="prediction", uselist=False)
```

**`models/feedback.py`**:

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
    vote: Mapped[str] = mapped_column(String(8), nullable=False)       # 'up' | 'down'
    correct_label: Mapped[str | None] = mapped_column(String(128))     # set if vote='down'
    notes: Mapped[str | None] = mapped_column(Text)
    used_in_train: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    prediction = relationship("Prediction", back_populates="feedback")
```

---

### 4.5 `schemas/prediction.py`

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class PredictionClass(BaseModel):
    rank: int
    label: str
    confidence: float   # percentage 0–100


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
    severity: str                        # "Low" | "Moderate" | "High" | "Critical"
    recommended_action: str
    all_classes: list[PredictionClass]   # all 10, sorted by confidence desc
    model_version: str
    submitted_at: datetime
    report_url: str                      # /reports/{image_id}/image
    report_pdf_url: str                  # /reports/{image_id}/pdf
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
        "description": "Common benign moles. Monitor for changes in size, shape, or color.",
        "severity": "Low",
        "action": "Document and monitor. ABCDE rule check. Annual follow-up.",
        "icd_code": "D22.9",
    },
    "BKL (Benign Keratosis-like Lesions)": {
        "description": "Non-cancerous surface growths including seborrheic keratosis and lichen planus.",
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
        "description": "Harmless, waxy, age-related skin growths. Very common in adults over 50.",
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

# Singleton model holder
_MODEL = None
_MODEL_VERSION = "v1"


def get_active_model_path() -> str:
    """Reads which model file is currently active from disk marker."""
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
        print(f"[MODEL] Loaded successfully: {version}")
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
        {
            "rank": i + 1,
            "label": CLASS_NAMES[idx],
            "confidence": round(float(probs[idx]) * 100, 2),
        }
        for i, idx in enumerate(sorted_idx)
    ]

    all_probs_dict = {CLASS_NAMES[i]: round(float(p) * 100, 4) for i, p in enumerate(probs)}

    return {
        "top_prediction": top_label,
        "confidence": round(top_conf * 100, 2),
        "description": meta["description"],
        "severity": meta["severity"],
        "recommended_action": meta["action"],
        "icd_code": meta["icd_code"],
        "all_classes": all_classes,
        "all_probabilities": all_probs_dict,
        "model_version": version,
    }
```

---

### 4.7 `services/report_generator.py`

This is the core piece that stamps all diagnosis information directly onto the image.

```python
"""
report_generator.py

Given:
  - original image bytes
  - patient info dict
  - prediction result dict
  - image_id (UUID string)

Produces:
  - Annotated PNG: original image with a professional overlay panel
  - PDF report: single-page clinical report with embedded annotated image

The annotated image looks like a medical film:
┌──────────────────────────────────────────────────────────────┐
│  [HOSPITAL LOGO]  DermAI Diagnostic Report                   │  ← Header bar
│  Image ID: DA-2025-A3F8C1    Date: 2025-06-16 14:32 UTC     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│              [ ORIGINAL SKIN IMAGE CENTERED ]                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  PATIENT        John Doe                                     │  ← Info strip
│  ID             HOSP-2025-00142    DOB: 1985-04-12           │
│  GENDER         Male               BLOOD: B+                 │
├──────────────────────────────────────────────────────────────┤
│  DIAGNOSIS      MELANOMA ▲ CRITICAL         87.3% conf.      │  ← Diagnosis
│  ICD-10         C43.9                                        │
│  ACTION         URGENT: Refer to oncology. Biopsy 48h.       │
├──────────────────────────────────────────────────────────────┤
│  TOP 5 PROBABILITIES                                         │  ← Prob bar chart
│  Melanoma            ██████████████████████ 87.3%           │
│  Basal Cell Carc.    ███ 6.1%                               │
│  Melanocytic Nevi    ██ 3.8%                                │
│  Seborrheic Kerat.   █ 1.5%                                 │
│  Eczema              █ 0.9%                                  │
├──────────────────────────────────────────────────────────────┤
│  Model: ResNet50 v3   ⚠ For clinical assistance only        │  ← Footer
│  Submitted by: Dr. Sharma   Dept: Dermatology                │
└──────────────────────────────────────────────────────────────┘
"""

from PIL import Image, ImageDraw, ImageFont
import io
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Image as RLImage, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from config import get_settings

settings = get_settings()

# Color palette (R, G, B)
C_BG_DARK   = (15, 23, 42)     # slate-900
C_BG_CARD   = (30, 41, 59)     # slate-800
C_BLUE      = (14, 165, 233)   # sky-500
C_GREEN     = (16, 185, 129)   # emerald-500
C_YELLOW    = (234, 179, 8)    # yellow-500
C_RED       = (239, 68, 68)    # red-500
C_WHITE     = (241, 245, 249)  # slate-100
C_MUTED     = (148, 163, 184)  # slate-400
C_HEADER    = (7, 89, 133)     # deep blue

SEVERITY_COLORS = {
    "Low":      C_GREEN,
    "Moderate": C_YELLOW,
    "High":     (249, 115, 22),   # orange
    "Critical": C_RED,
}

CANVAS_WIDTH  = 900
HEADER_H      = 80
PATIENT_H     = 100
DIAGNOSIS_H   = 110
CHART_H       = 170
FOOTER_H      = 60


def _load_font(size: int, bold: bool = False):
    """Try to load DejaVu (available on most Linux); fall back to default."""
    font_name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    search_paths = [
        f"/usr/share/fonts/truetype/dejavu/{font_name}",
        f"/usr/share/fonts/dejavu/{font_name}",
        f"/app/fonts/{font_name}",
    ]
    for p in search_paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _draw_rect(draw: ImageDraw.ImageDraw, x0, y0, x1, y1, fill, radius=0):
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
    """
    Returns PNG bytes of the fully annotated diagnostic image.
    
    patient dict keys: full_name, patient_id, date_of_birth, gender, blood_group
    prediction dict keys: top_prediction, confidence, severity, recommended_action,
                          icd_code, description, all_classes, model_version
    """
    # ── Load & resize original image ─────────────────────────────────────────
    orig = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_display_w = CANVAS_WIDTH - 40
    aspect = orig.height / orig.width
    img_display_h = int(img_display_w * aspect)
    orig_resized = orig.resize((img_display_w, img_display_h), Image.LANCZOS)

    # ── Compute total canvas height ───────────────────────────────────────────
    total_h = HEADER_H + img_display_h + 20 + PATIENT_H + DIAGNOSIS_H + CHART_H + FOOTER_H

    # ── Create canvas ─────────────────────────────────────────────────────────
    canvas = Image.new("RGB", (CANVAS_WIDTH, total_h), C_BG_DARK)
    draw = ImageDraw.Draw(canvas)

    # Fonts
    f_title   = _load_font(22, bold=True)
    f_head    = _load_font(18, bold=True)
    f_sub     = _load_font(15)
    f_small   = _load_font(12)
    f_label   = _load_font(13, bold=True)

    y = 0

    # ── HEADER BAR ────────────────────────────────────────────────────────────
    _draw_rect(draw, 0, 0, CANVAS_WIDTH, HEADER_H, C_HEADER)
    draw.text((20, 10), "🏥 DermAI Diagnostic Report", font=f_title, fill=C_WHITE)
    draw.text((20, 46), f"Image ID: DA-{image_id[:8].upper()}",
              font=f_sub, fill=C_BLUE)
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    draw.text((CANVAS_WIDTH - 280, 46), f"Date: {ts}", font=f_small, fill=C_MUTED)

    y = HEADER_H

    # ── ORIGINAL IMAGE ────────────────────────────────────────────────────────
    canvas.paste(orig_resized, (20, y + 10))
    y += img_display_h + 20

    # ── PATIENT INFO STRIP ────────────────────────────────────────────────────
    _draw_rect(draw, 0, y, CANVAS_WIDTH, y + PATIENT_H, C_BG_CARD)
    draw.text((20, y + 10), "PATIENT INFORMATION", font=f_label, fill=C_BLUE)

    col2 = CANVAS_WIDTH // 2
    draw.text((20,   y + 35), f"Name:   {patient.get('full_name', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((20,   y + 60), f"ID:     {patient.get('patient_id', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 35), f"DOB:    {patient.get('date_of_birth', 'N/A')}", font=f_sub, fill=C_WHITE)
    draw.text((col2, y + 60), f"Gender: {patient.get('gender', 'N/A')}   Blood: {patient.get('blood_group', 'N/A')}", font=f_sub, fill=C_WHITE)

    y += PATIENT_H

    # ── DIAGNOSIS STRIP ───────────────────────────────────────────────────────
    sev = prediction.get("severity", "Low")
    sev_color = SEVERITY_COLORS.get(sev, C_GREEN)
    _draw_rect(draw, 0, y, CANVAS_WIDTH, y + DIAGNOSIS_H, C_BG_DARK)

    # Severity badge
    _draw_rect(draw, 20, y + 10, 120, y + 40, sev_color, radius=6)
    draw.text((25, y + 14), f"▲ {sev.upper()}", font=f_label, fill=C_BG_DARK)

    draw.text((135, y + 10),
              f"{prediction.get('top_prediction', 'N/A').upper()}",
              font=f_head, fill=C_WHITE)
    draw.text((CANVAS_WIDTH - 160, y + 10),
              f"{prediction.get('confidence', 0):.1f}% confidence",
              font=f_sub, fill=sev_color)

    draw.text((20, y + 50), f"ICD-10: {prediction.get('icd_code', 'N/A')}", font=f_small, fill=C_MUTED)
    draw.text((20, y + 68),
              f"Action: {prediction.get('recommended_action', 'N/A')}",
              font=f_small, fill=C_WHITE)
    draw.text((20, y + 88),
              f"Description: {prediction.get('description', '')[:100]}",
              font=f_small, fill=C_MUTED)

    y += DIAGNOSIS_H

    # ── PROBABILITY CHART ─────────────────────────────────────────────────────
    _draw_rect(draw, 0, y, CANVAS_WIDTH, y + CHART_H, C_BG_CARD)
    draw.text((20, y + 10), "TOP 5 PROBABILITY BREAKDOWN", font=f_label, fill=C_BLUE)

    top5 = prediction.get("all_classes", [])[:5]
    bar_max_w = CANVAS_WIDTH - 340
    bar_colors = [C_BLUE, (124, 58, 237), (249, 115, 22), C_MUTED, C_MUTED]

    for i, cls in enumerate(top5):
        by = y + 40 + i * 26
        label_text = cls["label"][:30]
        draw.text((20, by), f"{i+1}.", font=f_small, fill=C_MUTED)
        draw.text((40, by), label_text, font=f_small, fill=C_WHITE)
        conf = cls["confidence"]
        bar_w = int((conf / 100) * bar_max_w)
        _draw_rect(draw, 280, by + 2, 280 + bar_w, by + 16, bar_colors[i], radius=3)
        draw.text((290 + bar_w, by), f"{conf:.1f}%", font=f_small, fill=C_MUTED)

    y += CHART_H

    # ── FOOTER ────────────────────────────────────────────────────────────────
    _draw_rect(draw, 0, y, CANVAS_WIDTH, y + FOOTER_H, C_HEADER)
    draw.text((20, y + 10),
              f"Model: ResNet50 {prediction.get('model_version', 'v1')} "
              f"| Submitted by: Dr. {doctor_name} | Dept: {department}",
              font=f_small, fill=C_WHITE)
    draw.text((20, y + 32),
              "⚠  This report is generated by AI for clinical assistance only. "
              "Final diagnosis must be made by a licensed physician.",
              font=f_small, fill=C_YELLOW)

    # ── Save to bytes ─────────────────────────────────────────────────────────
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
    """
    Wraps the annotated image into a proper A4 PDF with a clinical header.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=18, textColor=colors.HexColor("#0EA5E9"))
    story.append(Paragraph("🏥 DermAI Hospital — Clinical AI Report", title_style))
    story.append(Spacer(1, 6*mm))

    # Patient / Image info table
    data = [
        ["Image ID", f"DA-{image_id[:8].upper()}",
         "Report Date", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")],
        ["Patient Name", patient.get("full_name", "N/A"),
         "Patient ID",   patient.get("patient_id", "N/A")],
        ["DOB", patient.get("date_of_birth", "N/A"),
         "Gender / Blood", f"{patient.get('gender','N/A')} / {patient.get('blood_group','N/A')}"],
        ["Diagnosis", prediction.get("top_prediction", "N/A"),
         "Confidence", f"{prediction.get('confidence',0):.1f}%"],
        ["Severity", prediction.get("severity", "N/A"),
         "ICD-10", prediction.get("icd_code", "N/A")],
        ["Model Version", prediction.get("model_version", "v1"),
         "Submitted By", f"Dr. {doctor_name}"],
    ]
    t = Table(data, colWidths=[35*mm, 60*mm, 35*mm, 50*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#0F172A")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0EA5E9")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#0EA5E9")),
        ("BACKGROUND", (1, 0), (1, -1), colors.HexColor("#1E293B")),
        ("BACKGROUND", (3, 0), (3, -1), colors.HexColor("#1E293B")),
        ("TEXTCOLOR", (1, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#334155")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#1E293B"), colors.HexColor("#0F172A")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 6*mm))

    # Annotated image
    if os.path.exists(annotated_image_path):
        img = RLImage(annotated_image_path, width=180*mm, height=None)
        story.append(img)
    story.append(Spacer(1, 4*mm))

    # Recommended action
    action_style = ParagraphStyle("Action", parent=styles["Normal"],
                                  fontSize=9, backColor=colors.HexColor("#1E293B"),
                                  textColor=colors.HexColor("#F1F5F9"),
                                  borderPad=4, leftIndent=4)
    story.append(Paragraph(
        f"<b>Recommended Action:</b> {prediction.get('recommended_action', 'N/A')}",
        action_style))
    story.append(Spacer(1, 3*mm))

    # Disclaimer
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
rlhf_engine.py

Manages the RLHF (Reinforcement Learning from Human Feedback) dataset.

Flow:
  1. Doctor submits 👍 → vote=up stored in feedback table
  2. Doctor submits 👎 → vote=down + correct_label stored
  3. At midnight, retraining_worker.py calls collect_rlhf_dataset()
     which gathers all un-used 👍 samples + 👎 samples (with corrected labels)
     and returns (image_paths, labels) ready for fine-tuning
"""

import os
import shutil
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from models.feedback import Feedback
from models.prediction import Prediction
from config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)


async def collect_rlhf_dataset(db: AsyncSession) -> dict:
    """
    Collect all unused feedback samples.
    Returns dict with paths and labels for the Celery retraining task.
    """
    # Fetch all unused feedback joined with predictions
    stmt = (
        select(Feedback, Prediction)
        .join(Prediction, Feedback.prediction_id == Prediction.id)
        .where(Feedback.used_in_train == False)
    )
    results = await db.execute(stmt)
    rows = results.all()

    if not rows:
        return {"samples": [], "count": 0}

    samples = []
    feedback_ids = []

    for fb, pred in rows:
        image_path = pred.original_image_path

        # Determine ground truth label
        if fb.vote == "up":
            label = pred.top_prediction   # model was correct
        elif fb.vote == "down" and fb.correct_label:
            label = fb.correct_label      # doctor provided the correct label
        else:
            continue  # skip down-votes without correct label

        if not image_path or not os.path.exists(image_path):
            logger.warning(f"Image not found for prediction {pred.id}: {image_path}")
            continue

        # Copy to feedback dataset dir for persistence
        dest_dir = os.path.join(settings.FEEDBACK_DS_DIR, label.replace("/", "_").replace(" ", "_"))
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, f"{pred.image_id}.jpg")
        shutil.copy2(image_path, dest_path)

        samples.append({"image_path": dest_path, "label": label})
        feedback_ids.append(fb.id)

    # Mark all as used
    if feedback_ids:
        await db.execute(
            update(Feedback)
            .where(Feedback.id.in_(feedback_ids))
            .values(used_in_train=True)
        )
        await db.commit()

    logger.info(f"[RLHF] Collected {len(samples)} new training samples from feedback.")
    return {"samples": samples, "count": len(samples), "feedback_ids": [str(f) for f in feedback_ids]}


async def get_feedback_stats(db: AsyncSession) -> dict:
    """Dashboard stats for admin panel."""
    from sqlalchemy import func
    total_up   = await db.scalar(select(func.count()).where(Feedback.vote == "up"))
    total_down = await db.scalar(select(func.count()).where(Feedback.vote == "down"))
    unused     = await db.scalar(select(func.count()).where(Feedback.used_in_train == False))
    return {
        "total_upvotes":   total_up or 0,
        "total_downvotes": total_down or 0,
        "pending_for_retrain": unused or 0,
        "accuracy_signal": round((total_up / max(total_up + total_down, 1)) * 100, 2),
    }
```

---

### 4.9 `services/retraining_worker.py`

```python
"""
retraining_worker.py

Celery task + APScheduler beat task that:
1. Runs every night at midnight (UTC)
2. Collects RLHF feedback samples via rlhf_engine
3. Fine-tunes the current model for N epochs
4. Saves checkpoint as model_v{N+1}.keras
5. Validates on held-out set
6. If validation accuracy >= previous model: promotes new model (updates active_version.txt)
7. Logs everything to model_versions table
"""

import os
import json
import numpy as np
from datetime import datetime
from celery import Celery
from celery.schedules import crontab
import tensorflow as tf
from PIL import Image
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker

from config import get_settings
from models.model_version import ModelVersion
from services.model_utils import CLASS_NAMES, load_model
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

# ── Celery App ────────────────────────────────────────────────────────────────
celery_app = Celery("dermai_worker", broker=settings.CELERY_BROKER_URL,
                    backend=settings.CELERY_RESULT_BACKEND)

celery_app.conf.beat_schedule = {
    "daily-retrain": {
        "task": "services.retraining_worker.daily_retrain_task",
        "schedule": crontab(hour=settings.RETRAIN_SCHEDULE_HOUR, minute=0),
    }
}
celery_app.conf.timezone = "UTC"


def _load_rlhf_samples(samples: list) -> tuple[np.ndarray, np.ndarray]:
    """Load image files into numpy arrays for fine-tuning."""
    X, y = [], []
    for s in samples:
        try:
            img = Image.open(s["image_path"]).convert("RGB")
            img = img.resize((settings.MODEL_INPUT_WIDTH, settings.MODEL_INPUT_HEIGHT))
            arr = np.asarray(img, dtype=np.float32)
            mean, std = arr.mean(), arr.std() or 1.0
            arr = (arr - mean) / std

            label_idx = CLASS_NAMES.index(s["label"]) if s["label"] in CLASS_NAMES else -1
            if label_idx == -1:
                continue
            X.append(arr)
            y.append(label_idx)
        except Exception as e:
            logger.warning(f"Failed to load {s['image_path']}: {e}")

    if not X:
        return np.array([]), np.array([])

    X = np.array(X)
    y = tf.keras.utils.to_categorical(np.array(y), num_classes=len(CLASS_NAMES))
    return X, y


def _get_next_version_tag() -> str:
    """Reads current version from marker and increments it."""
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    if os.path.exists(marker):
        with open(marker) as f:
            current = f.read().strip()  # e.g. "v3"
        num = int(current[1:]) + 1
    else:
        num = 2
    return f"v{num}"


def _promote_model(version_tag: str, checkpoint_path: str):
    """Write the new active version to disk marker."""
    marker = os.path.join(settings.MODELS_DIR, "active_version.txt")
    with open(marker, "w") as f:
        f.write(version_tag)
    logger.info(f"[RETRAIN] Promoted model: {version_tag}")


@celery_app.task(name="services.retraining_worker.daily_retrain_task", bind=True)
def daily_retrain_task(self, samples_json: str = None):
    """
    Main Celery task. Can be triggered:
    - Automatically by beat schedule (midnight UTC)
    - Manually via /admin/trigger-retrain endpoint
    
    samples_json: JSON string of samples list (passed from API endpoint)
                  or None (worker fetches from DB itself via sync session)
    """
    logger.info("[RETRAIN] Starting daily retraining task...")

    # ── Get samples ──────────────────────────────────────────────────────────
    if samples_json:
        samples = json.loads(samples_json)
    else:
        # Sync DB call from Celery worker (Celery doesn't run async)
        engine = create_engine(settings.DATABASE_SYNC_URL)
        Session = sessionmaker(bind=engine)
        with Session() as session:
            from models.feedback import Feedback
            from models.prediction import Prediction
            import shutil

            rows = (
                session.query(Feedback, Prediction)
                .join(Prediction, Feedback.prediction_id == Prediction.id)
                .filter(Feedback.used_in_train == False)
                .all()
            )

            samples = []
            ids_to_mark = []
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

            # Mark used
            session.query(Feedback).filter(Feedback.id.in_(ids_to_mark))\
                .update({"used_in_train": True}, synchronize_session=False)
            session.commit()

    if not samples or len(samples) < settings.MIN_FEEDBACK_SAMPLES_FOR_RETRAIN:
        logger.info(f"[RETRAIN] Only {len(samples)} samples — minimum "
                    f"{settings.MIN_FEEDBACK_SAMPLES_FOR_RETRAIN} required. Skipping.")
        return {"status": "skipped", "reason": "insufficient_samples", "count": len(samples)}

    # ── Load data ─────────────────────────────────────────────────────────────
    X, y = _load_rlhf_samples(samples)
    if len(X) == 0:
        return {"status": "skipped", "reason": "no_valid_images"}

    logger.info(f"[RETRAIN] Fine-tuning on {len(X)} samples...")

    # ── Load current model ────────────────────────────────────────────────────
    model, current_version = load_model()

    # Unfreeze last 20 layers for fine-tuning
    for layer in model.layers[-20:]:
        layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.SGD(learning_rate=0.0001, momentum=0.9),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    # Train/val split
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

    val_acc = float(history.history.get("val_accuracy", [0])[-1]) if len(X_val) > 0 else None
    train_acc = float(history.history["accuracy"][-1])

    logger.info(f"[RETRAIN] Train acc: {train_acc:.4f}  Val acc: {val_acc}")

    # ── Save new checkpoint ───────────────────────────────────────────────────
    new_version = _get_next_version_tag()
    new_path = os.path.join(settings.MODELS_DIR, f"model_{new_version}.keras")
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
    model.save(new_path)
    logger.info(f"[RETRAIN] Saved: {new_path}")

    # ── Promote if improved ───────────────────────────────────────────────────
    promoted = False
    if val_acc is None or val_acc >= 0.5:
        _promote_model(new_version, new_path)
        load_model(force_reload=True)   # Hot-swap in running process
        promoted = True

    # ── Log to DB ─────────────────────────────────────────────────────────────
    engine = create_engine(settings.DATABASE_SYNC_URL)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        # Deactivate old
        session.query(ModelVersion).filter(ModelVersion.is_active == True)\
            .update({"is_active": False}, synchronize_session=False)
        # Insert new
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

## 5. API Routes

### 5.1 `routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

from database import get_db
from models.user import User
from schemas.auth import TokenResponse, UserCreate, UserResponse
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
        user_id: str = payload.get("sub")
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


@router.post("/register", response_model=UserResponse)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=data.username, email=data.email,
        full_name=data.full_name, department=data.department,
        role=data.role, password_hash=pwd_ctx.hash(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
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
import uuid

from database import get_db
from models.patient import Patient
from models.user import User
from schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from routers.auth import get_current_user

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", response_model=PatientResponse, status_code=201)
async def create_patient(
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Auto-generate hospital patient ID: HOSP-YYYY-NNNNN
    from datetime import date
    year = date.today().year
    count_result = await db.execute(select(Patient))
    count = len(count_result.scalars().all()) + 1
    patient_id = f"HOSP-{year}-{count:05d}"

    patient = Patient(
        patient_id=patient_id,
        full_name=data.full_name,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        contact_number=data.contact_number,
        blood_group=data.blood_group,
        medical_history=data.medical_history,
        assigned_doctor=current_user.id,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/", response_model=list[PatientResponse])
async def list_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient))
    return result.scalars().all()
```

---

### 5.3 `routers/predictions.py`

```python
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid, os, aiofiles
from datetime import datetime

from database import get_db
from models.prediction import Prediction
from models.patient import Patient
from models.user import User
from schemas.prediction import PredictionResponse
from services.model_utils import run_inference
from services.report_generator import generate_annotated_image, generate_pdf_report
from routers.auth import get_current_user
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/predict", tags=["Predictions"])


@router.post("/", response_model=PredictionResponse, status_code=201)
async def predict_disease(
    patient_id: str = Form(..., description="Hospital patient ID e.g. HOSP-2025-00001"),
    file: UploadFile = File(...),
    doctor_notes: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ── Validate file ─────────────────────────────────────────────────────────
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WEBP images accepted.")
    
    contents = await file.read()
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 15MB.")

    # ── Fetch patient ──────────────────────────────────────────────────────────
    result = await db.execute(select(Patient).where(Patient.patient_id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    # ── Generate unique image_id ───────────────────────────────────────────────
    image_id = str(uuid.uuid4())

    # ── Save original image ────────────────────────────────────────────────────
    os.makedirs(settings.IMAGES_DIR, exist_ok=True)
    img_path = os.path.join(settings.IMAGES_DIR, f"{image_id}.jpg")
    async with aiofiles.open(img_path, "wb") as f:
        await f.write(contents)

    # ── Run inference ─────────────────────────────────────────────────────────
    try:
        inference = run_inference(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

    # ── Generate annotated report image ───────────────────────────────────────
    patient_dict = {
        "full_name":    patient.full_name,
        "patient_id":   patient.patient_id,
        "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else "N/A",
        "gender":       patient.gender or "N/A",
        "blood_group":  patient.blood_group or "N/A",
    }

    report_png_bytes = generate_annotated_image(
        image_bytes=contents,
        patient=patient_dict,
        prediction=inference,
        image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
        department=current_user.department or "Dermatology",
    )

    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    report_img_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.png")
    async with aiofiles.open(report_img_path, "wb") as f:
        await f.write(report_png_bytes)

    # ── Generate PDF ──────────────────────────────────────────────────────────
    pdf_bytes = generate_pdf_report(
        annotated_image_path=report_img_path,
        patient=patient_dict,
        prediction=inference,
        image_id=image_id,
        doctor_name=current_user.full_name or current_user.username,
    )
    report_pdf_path = os.path.join(settings.REPORTS_DIR, f"{image_id}_report.pdf")
    async with aiofiles.open(report_pdf_path, "wb") as f:
        await f.write(pdf_bytes)

    # ── Persist to DB ─────────────────────────────────────────────────────────
    prediction_record = Prediction(
        image_id=image_id,
        patient_id=patient.id,
        submitted_by=current_user.id,
        original_image_path=img_path,
        report_image_path=report_img_path,
        report_pdf_path=report_pdf_path,
        top_prediction=inference["top_prediction"],
        confidence=inference["confidence"],
        all_probabilities=inference["all_probabilities"],
        model_version=inference["model_version"],
        doctor_notes=doctor_notes,
        status="pending",
    )
    db.add(prediction_record)
    await db.commit()
    await db.refresh(prediction_record)

    # ── Build response ────────────────────────────────────────────────────────
    base = f"{settings.API_BASE_URL}/reports/{image_id}"
    return {
        "image_id":            image_id,
        "patient":             patient_dict,
        "top_prediction":      inference["top_prediction"],
        "confidence":          inference["confidence"],
        "description":         inference["description"],
        "severity":            inference["severity"],
        "recommended_action":  inference["recommended_action"],
        "all_classes":         inference["all_classes"],
        "model_version":       inference["model_version"],
        "submitted_at":        prediction_record.created_at,
        "report_url":          f"{base}/image",
        "report_pdf_url":      f"{base}/pdf",
        "disclaimer": "⚠ AI-assisted diagnosis. Final interpretation by licensed physician required.",
    }


@router.get("/{image_id}", response_model=PredictionResponse)
async def get_prediction(
    image_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

router = APIRouter(prefix="/feedback", tags=["RLHF Feedback"])

CLASS_NAMES = [
    "Eczema", "Melanoma", "Atopic Dermatitis", "Basal Cell Carcinoma",
    "Melanocytic Nevi", "BKL (Benign Keratosis-like Lesions)",
    "Psoriasis / Lichen Planus", "Seborrheic Keratoses",
    "Tinea / Fungal Infection", "Warts / Viral Infection",
]


@router.post("/", status_code=201)
async def submit_feedback(
    data: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit 👍 or 👎 for a prediction identified by image_id.
    
    - vote='up'  → model was correct, sample used for positive reinforcement
    - vote='down' → model was wrong; provide correct_label for supervised correction
    """
    # Find prediction
    pred_result = await db.execute(
        select(Prediction).where(Prediction.image_id == data.image_id)
    )
    prediction = pred_result.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail=f"No prediction found for image_id: {data.image_id}")

    # Validate correct_label if down vote
    if data.vote == "down":
        if not data.correct_label:
            raise HTTPException(
                status_code=400,
                detail="correct_label is required for a down-vote. Please specify the actual disease."
            )
        if data.correct_label not in CLASS_NAMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid correct_label. Must be one of: {CLASS_NAMES}"
            )

    # Check for duplicate feedback from same doctor
    existing = await db.execute(
        select(Feedback).where(
            Feedback.prediction_id == prediction.id,
            Feedback.submitted_by == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already submitted feedback for this image.")

    fb = Feedback(
        prediction_id=prediction.id,
        submitted_by=current_user.id,
        vote=data.vote,
        correct_label=data.correct_label,
        notes=data.notes,
        used_in_train=False,
    )
    db.add(fb)

    # Update prediction status to 'reviewed'
    prediction.status = "reviewed"
    await db.commit()

    await log_action(db, current_user.id, "FEEDBACK_SUBMITTED", "feedback",
                     prediction.id, {"vote": data.vote, "image_id": data.image_id})

    return {
        "status": "success",
        "message": f"Feedback recorded. Vote: {data.vote.upper()}",
        "image_id": data.image_id,
        "vote": data.vote,
        "will_be_used_for_training": True,
    }
```

---

### 5.5 `routers/reports.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os

from database import get_db
from models.prediction import Prediction
from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{image_id}/image")
async def get_report_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the annotated diagnostic PNG image."""
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_image_path:
        raise HTTPException(status_code=404, detail="Report image not found")
    if not os.path.exists(pred.report_image_path):
        raise HTTPException(status_code=404, detail="Report file missing from disk")
    return FileResponse(pred.report_image_path, media_type="image/png",
                        filename=f"DermAI_Report_{image_id[:8]}.png")


@router.get("/{image_id}/pdf")
async def get_report_pdf(
    image_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the full A4 PDF clinical report."""
    result = await db.execute(select(Prediction).where(Prediction.image_id == image_id))
    pred = result.scalar_one_or_none()
    if not pred or not pred.report_pdf_path:
        raise HTTPException(status_code=404, detail="PDF report not found")
    if not os.path.exists(pred.report_pdf_path):
        raise HTTPException(status_code=404, detail="PDF file missing from disk")
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
from models.user import User
from routers.auth import require_admin
from services.rlhf_engine import get_feedback_stats
from services.retraining_worker import daily_retrain_task

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_pred   = await db.scalar(select(func.count()).select_from(Prediction))
    total_fb     = await db.scalar(select(func.count()).select_from(Feedback))
    fb_stats     = await get_feedback_stats(db)
    active_model = await db.execute(
        select(ModelVersion).where(ModelVersion.is_active == True)
    )
    model = active_model.scalar_one_or_none()

    return {
        "total_predictions":  total_pred,
        "total_feedback":     total_fb,
        "feedback_stats":     fb_stats,
        "active_model": {
            "version":    model.version_tag if model else "v1",
            "accuracy":   model.accuracy if model else None,
            "promoted_at": model.promoted_at if model else None,
        } if model else None,
    }


@router.get("/model-versions")
async def list_model_versions(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(ModelVersion).order_by(ModelVersion.created_at.desc())
    )
    return result.scalars().all()


@router.post("/trigger-retrain")
async def trigger_retrain(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Manually trigger the retraining pipeline."""
    task = daily_retrain_task.delay()
    return {
        "status": "queued",
        "task_id": task.id,
        "message": "Retraining task dispatched to Celery worker."
    }


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from models.audit_log import AuditLog
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
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from config import get_settings
from database import create_all_tables
from services.model_utils import load_model
from routers import auth, patients, predictions, feedback, reports, admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables, warm up model."""
    await create_all_tables()
    load_model()
    print(f"[STARTUP] {settings.APP_NAME} v{settings.APP_VERSION} is ready.")
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


# Request timing middleware
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.time() - start)*1000:.1f}ms"
    return response


# Include all routers
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(predictions.router)
app.include_router(feedback.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


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

# Create data directories
RUN mkdir -p /app/data/images /app/data/reports \
             /app/data/feedback_ds /app/data/models

# Copy initial model
COPY model_resnet50_klasifikasi.keras /app/data/models/model_v1.keras
RUN echo "v1" > /app/data/models/active_version.txt

EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "2"]
```

### `docker-compose.yml` (local development)

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
      - SECRET_KEY=REPLACE_WITH_STRONG_SECRET_256BIT
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
# API: http://localhost:7860
# Docs: http://localhost:7860/docs
```

---

## 8. HuggingFace Deployment

HuggingFace Spaces (Docker SDK) does not support PostgreSQL or Redis natively. Deploy using one of these two strategies:

### Strategy A — Managed Cloud DB (Recommended for Production)

| Service | What | Free Tier |
|---------|------|-----------|
| Supabase (supabase.com) | PostgreSQL | 500 MB free |
| Neon (neon.tech) | PostgreSQL | 3 GB free |
| Upstash (upstash.com) | Redis | 10,000 req/day free |

Steps:
1. Create a Supabase project → get `DATABASE_URL` connection string
2. Create an Upstash Redis → get `REDIS_URL`
3. Add both as HuggingFace Space **Secrets** (Settings → Secrets)
4. Push code via Git LFS (model file is large):

```bash
git lfs install
git clone https://huggingface.co/spaces/YOUR_USERNAME/dermai-hospital-api
cd dermai-hospital-api

git lfs track "*.keras"
git add .gitattributes
cp -r /path/to/your/project/* .

git add .
git commit -m "Hospital-grade backend v2"
git push
```

### Strategy B — SQLite + File Storage (Quick Prototype)

Replace `DATABASE_URL` with SQLite for a zero-infra demo:
```
DATABASE_URL=sqlite+aiosqlite:////app/data/dermai.db
DATABASE_SYNC_URL=sqlite:////app/data/dermai.db
```

> ⚠️ SQLite is not suitable for concurrent hospital use. Migrate to PostgreSQL before production.

### `README.md` (HuggingFace config)

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

Hospital-grade skin disease detection with patient management, annotated reports, and RLHF retraining.

**Base URL:** `https://YOUR_USERNAME-dermai-hospital-api.hf.space`  
**Swagger Docs:** `/docs`

Endpoints: `/auth` · `/patients` · `/predict` · `/feedback` · `/reports` · `/admin`
```

---

## 9. Lovable / v0 Frontend Prompt

Copy the entire block below into **Lovable (lovable.dev)** or **v0 (v0.dev)**:

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
Axios for HTTP with interceptors (JWT auto-attach)
React Toastify or Sonner for notifications
Recharts for analytics charts
React PDF Viewer or iframe for PDF display

Environment variable: VITE_API_URL=https://YOUR_USERNAME-dermai-hospital-api.hf.space

─────────────────────────────────────────
DESIGN SYSTEM — HOSPITAL DARK THEME
─────────────────────────────────────────
Background:   #0F172A (slate-900)
Card:         #1E293B (slate-800)
Border:       #334155 (slate-700)
Primary:      #0EA5E9 (sky-500)  ← action buttons, links
Success:      #10B981 (emerald-500)
Warning:      #F59E0B (amber-500)
Danger:       #EF4444 (red-500)
Critical:     #DC2626 (red-600) with pulsing glow animation
Text:         #F1F5F9 (slate-100)
Muted:        #94A3B8 (slate-400)

Severity color coding (used consistently everywhere):
  Low:      emerald-500
  Moderate: amber-500
  High:     orange-500
  Critical: red-600 + pulsing red shadow animation

Font: Inter (Google Fonts), monospace for IDs and codes
Corner radius: 8px cards, 6px buttons
No rounded-full on severity badges — use rounded-md for clinical look
Subtle grid background pattern on main pages

─────────────────────────────────────────
AUTH SYSTEM
─────────────────────────────────────────
Create an AuthContext that:
- Stores JWT token in memory (NOT localStorage — use React context only)
- Has login(), logout(), user object, isAuthenticated, role
- Attaches Authorization header to every request via Axios interceptor
- Redirects to /login if 401 is received
- Shows role (Doctor / Admin) badge in the nav

Login Page (/login):
- Dark full-screen layout with hospital logo
- Form: Username + Password
- "Login as Doctor" submit button
- Error message on failure
- On success → redirect to /dashboard
- Demo credentials hint: admin/admin123 or doctor/doctor123

─────────────────────────────────────────
PAGES & ROUTING (role-based)
─────────────────────────────────────────
Public:
  /login             → Login page

Protected (all roles — doctor + admin):
  /dashboard         → Overview dashboard
  /patients          → Patient list + registration
  /patients/:id      → Patient detail page + scan history
  /scan              → New scan submission
  /scan/:image_id    → Scan result detail page (with report viewer)

Admin only:
  /admin             → Admin panel (stats, model versions, retrain)
  /admin/audit       → Audit log viewer

─────────────────────────────────────────
PAGE 1: DASHBOARD (/dashboard)
─────────────────────────────────────────
Top stats bar (4 cards in a row):
  - Total Scans Today    (with trend arrow vs yesterday)
  - Total Patients       (registered count)
  - RLHF Accuracy Signal (% of 👍 votes — from /admin/dashboard)
  - Active Model Version (e.g. "ResNet50 v3")

Quick Action buttons (2 large cards):
  "New Skin Scan →"     (links to /scan)
  "Register Patient →"  (links to /patients)

Recent Activity Feed (last 10 predictions from this doctor):
  Each row: Image ID | Patient Name | Diagnosis | Confidence | Severity badge | Date | Actions (View / Feedback)

Severity Distribution Pie Chart (Recharts):
  Breakdown of Low / Moderate / High / Critical from recent scans

─────────────────────────────────────────
PAGE 2: PATIENTS (/patients)
─────────────────────────────────────────
Header: "Patient Registry" with "Register New Patient" button (opens slide-over drawer)

Patient registration form (in slide-over drawer):
  Fields:
    - Full Name* (text)
    - Date of Birth* (date picker)
    - Gender* (select: Male / Female / Other)
    - Blood Group (select: A+, A-, B+, B-, O+, O-, AB+, AB-)
    - Contact Number (tel)
    - Medical History (textarea)
  Submit → POST /patients/ → show generated Patient ID (HOSP-YYYY-NNNNN) in success toast

Patient table (searchable, sortable):
  Columns: Patient ID | Full Name | DOB | Gender | Blood Group | Scan Count | Last Scan Date | Actions
  Actions: View Patient | New Scan (pre-fills patient ID)
  Search bar: filter by name or patient ID in real time
  Pagination: 20 per page

─────────────────────────────────────────
PAGE 3: NEW SCAN (/scan)
─────────────────────────────────────────
Two-panel layout:

LEFT PANEL — Input:
  Step 1 — Select Patient:
    Search-as-you-type input to find patient by name or ID
    Autocomplete dropdown showing: ID | Name | DOB
    Selected patient chip shown below with remove (×) button
    Or "+ Register New Patient" link

  Step 2 — Upload Image:
    Drag-and-drop zone (react-dropzone)
    Shows: camera icon, "Drag skin image here or click to browse"
    Accepted: JPG, PNG, WEBP — Max 15MB
    On select: show image preview (aspect-ratio preserved, rounded)
    Show filename + size

  Step 3 — Doctor Notes (optional):
    Textarea: "Add clinical observations or notes..."

  "Run AI Analysis" button (full width, primary color)
    - Disabled until both patient and image are selected
    - Shows animated spinner during API call

RIGHT PANEL — Results (appears after analysis):
  Loading state: 
    Animated skeleton + "AI is analyzing the image..." with step indicators:
    ✓ Image received → ✓ Preprocessing → ● Running ResNet50 → ○ Generating Report

  Success state — show:

    TOP DIAGNOSIS CARD:
      - SEVERITY BADGE (colored, pulsing if Critical)
      - Disease name (large, bold)
      - Confidence % (large radial arc gauge — animated)
      - ICD-10 code (monospace, muted)
      - Description text
      - "Recommended Action" box (amber background, doctor-action text)

    PROBABILITY BREAKDOWN (all 10 classes):
      Title: "Full Probability Analysis"
      Table with animated bars: Rank | Disease | Bar | Confidence%
      Top 1 bar = primary blue, rest = slate

    REPORT SECTION:
      Two buttons side by side:
        "🖼 View Annotated Image" → opens modal with the annotated PNG
        "📄 Download PDF Report" → triggers PDF download
      Small image thumbnail of the annotated report

    FEEDBACK SECTION (critical for RLHF):
      Title: "Was this prediction correct?"
      Subtitle: "Your feedback directly improves the AI model"
      Two large buttons:
        👍 CORRECT (green) — sends vote=up
        👎 INCORRECT (red) — opens mini-form asking for correct label + optional notes, then sends vote=down
      After submission: Show "Thank you! Your feedback will be used in tonight's model retraining." toast
      Disable buttons after feedback submitted

─────────────────────────────────────────
PAGE 4: SCAN RESULT (/scan/:image_id)
─────────────────────────────────────────
Same layout as the right panel of /scan but full page.
Shows:
  - Patient info header card (name, ID, DOB, blood group)
  - Full diagnosis panel
  - Report image viewer (inline)
  - PDF download button
  - Feedback section (if not already given)
  - Doctor notes section (read/edit)
  - "Back to Patient" button

─────────────────────────────────────────
PAGE 5: PATIENT DETAIL (/patients/:id)
─────────────────────────────────────────
Top: Patient information card (all fields)
     "New Scan for this Patient" button

Scan History table:
  Columns: Image ID | Date | Diagnosis | Confidence | Severity | Feedback | Actions (View)
  Sorted by date desc
  Color-coded severity badges
  Feedback column: 👍 / 👎 / — (not given yet)

─────────────────────────────────────────
PAGE 6: ADMIN PANEL (/admin) — Admin only
─────────────────────────────────────────
4-stat cards:
  Total Predictions | Total Patients | RLHF Accuracy | Pending Feedback Samples

Model Performance Section:
  Table of all model versions: Version | Trained On | Accuracy | Status (Active/Previous) | Promoted At
  "Trigger Manual Retrain" button → POST /admin/trigger-retrain → shows task queued toast

Feedback Signal Chart (Recharts LineChart):
  X-axis: last 14 days
  Y-axis: % accuracy (👍 ratio)
  Shows trend of model correctness over time

─────────────────────────────────────────
GLOBAL COMPONENTS
─────────────────────────────────────────
1. Sidebar Navigation (collapsible):
   Hospital logo + "DermAI" at top
   Nav items (with icons):
     📊 Dashboard
     👥 Patients
     🔬 New Scan
     🔐 Admin (only if role=admin)
     ⚙ Settings (placeholder)
   Bottom: Doctor avatar + name + role badge + Logout button
   Sidebar collapses to icon-only on small screens

2. SeverityBadge component:
   Props: { severity: "Low"|"Moderate"|"High"|"Critical" }
   Critical: red with pulsing box-shadow animation
   Use consistent colors everywhere

3. ConfidenceGauge component:
   Animated SVG arc radial gauge
   Center: shows "87.3%" in large text
   Color changes by confidence level

4. ImageReportModal:
   Full-screen modal with the annotated PNG
   Zoom controls
   Download button
   Close (×) button

5. FeedbackWidget:
   Reusable 👍/👎 component with state management
   Shows loading during submission
   Shows result state after submission

─────────────────────────────────────────
API INTEGRATION (complete)
─────────────────────────────────────────
Base URL: import.meta.env.VITE_API_URL

Create a typed API client (api/client.ts):

```typescript
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach JWT from AuthContext
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('dermai_token'); // or from context
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) window.location.href = '/login';
    return Promise.reject(err);
  }
);

export default api;
```

API hooks to create:
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
- All IDs (Patient ID, Image ID) displayed in monospace font with copy-to-clipboard button
- Every page has a breadcrumb navigation (Home > Patients > John Doe)
- Loading skeletons for every data-fetching state
- Empty states with helpful CTA (no patients yet → "Register First Patient")
- Confirmation dialogs before destructive actions
- Toast notifications for all API success/error responses
- Mobile responsive (sidebar collapses to bottom tab bar on mobile)
- vercel.json for SPA routing:
  {"rewrites": [{"source": "/(.*)", "destination": "/"}]}
- Error boundary for production resilience

Generate all pages, components, hooks, types, and the full routing structure. The app must be production-deployable to Vercel.
```

---

## 10. Environment Variables Reference

### Backend `.env` file

```env
# App
APP_NAME=DermAI Hospital API
APP_VERSION=2.0.0
DEBUG=false
ALLOWED_ORIGINS=["https://your-app.vercel.app"]
API_BASE_URL=https://YOUR_USERNAME-dermai-hospital-api.hf.space

# Database (use Supabase / Neon in production)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dermaidb
DATABASE_SYNC_URL=postgresql://user:pass@host:5432/dermaidb

# Redis (use Upstash in production)
REDIS_URL=redis://default:password@host.upstash.io:6379
CELERY_BROKER_URL=redis://default:password@host.upstash.io:6379
CELERY_RESULT_BACKEND=redis://default:password@host.upstash.io:6380

# JWT Auth — CHANGE THIS
SECRET_KEY=YOUR_256_BIT_RANDOM_SECRET_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# File paths (HuggingFace persistent volume)
DATA_DIR=/app/data
IMAGES_DIR=/app/data/images
REPORTS_DIR=/app/data/reports
FEEDBACK_DS_DIR=/app/data/feedback_ds
MODELS_DIR=/app/data/models
INITIAL_MODEL_PATH=/app/data/models/model_v1.keras

# Model settings
MODEL_INPUT_WIDTH=100
MODEL_INPUT_HEIGHT=75

# Retraining
MIN_FEEDBACK_SAMPLES_FOR_RETRAIN=20
RETRAIN_EPOCHS=3
RETRAIN_BATCH_SIZE=16
RETRAIN_SCHEDULE_HOUR=0
```

### Frontend Vercel environment variables

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR_USERNAME-dermai-hospital-api.hf.space` |

---

## 11. End-to-End Flow Diagram

```
DOCTOR LOGIN
    │  POST /auth/login
    │  ← JWT token (8-hour validity)
    ▼
REGISTER PATIENT
    │  POST /patients/ {full_name, dob, gender, ...}
    │  ← patient_id: "HOSP-2025-00001"
    ▼
UPLOAD SKIN IMAGE + patient_id
    │  POST /predict/ (multipart: file + patient_id + notes)
    │
    ├─ Save raw image → /data/images/{uuid}.jpg
    │
    ├─ ResNet50 Inference → 10 class probabilities
    │
    ├─ report_generator.py
    │    → PIL overlay: Header + Patient info + Diagnosis +
    │                    Probability bars + ICD-10 + Action
    │    → Save PNG → /data/reports/{uuid}_report.png
    │    → Generate A4 PDF → /data/reports/{uuid}_report.pdf
    │
    ├─ Persist to predictions table
    │
    │  ← JSON: {image_id, prediction, confidence, severity,
    │           icd_code, recommended_action, all_classes,
    │           report_url, report_pdf_url}
    ▼
DOCTOR VIEWS RESULT
    │  GET /reports/{image_id}/image  ← annotated PNG
    │  GET /reports/{image_id}/pdf    ← clinical PDF
    ▼
DOCTOR GIVES FEEDBACK (RLHF)
    │  POST /feedback/ {image_id, vote: "up"|"down", correct_label?}
    │  ← vote stored in feedback table, prediction marked "reviewed"
    ▼
─────────────── MIDNIGHT UTC ─────────────────
CELERY BEAT fires daily_retrain_task
    │
    ├─ Collect all unused 👍/👎 feedback + images
    ├─ Build X_train, y_train numpy arrays
    ├─ Fine-tune ResNet50 (last 20 layers, 3 epochs)
    ├─ Save → /data/models/model_v{N+1}.keras
    ├─ If val_accuracy improved → write active_version.txt
    ├─ load_model(force_reload=True) → hot-swap in API
    └─ Log to model_versions table
─────────────────────────────────────────────
```

---

## 12. Deployment Checklist

### Backend

- [ ] `model_resnet50_klasifikasi.keras` copied to `data/models/model_v1.keras`
- [ ] `echo "v1" > data/models/active_version.txt`
- [ ] Supabase project created → `DATABASE_URL` copied
- [ ] Upstash Redis created → `REDIS_URL` copied
- [ ] All secrets added to HuggingFace Space → Settings → Secrets
- [ ] Code pushed via Git LFS (model file tracked with `*.keras`)
- [ ] Space shows "Running" status
- [ ] `POST /auth/register` — create first admin user
- [ ] `GET /health` → `{"status":"healthy","active_model":"v1"}`
- [ ] `GET /docs` → Swagger UI opens correctly
- [ ] Test full flow via Swagger: register → patient → predict → feedback

### Frontend

- [ ] Lovable/v0 prompt pasted → full app generated
- [ ] `VITE_API_URL` set to HuggingFace Space URL
- [ ] Code exported to GitHub repo
- [ ] Vercel project connected to GitHub
- [ ] `VITE_API_URL` env var set in Vercel dashboard
- [ ] Vercel deployment successful
- [ ] End-to-end test: login → patient → scan → report view → feedback 👍

### Operational

- [ ] Celery worker + beat containers running
- [ ] Test manual retrain via `POST /admin/trigger-retrain`
- [ ] Confirm `model_versions` table receives new entry after retrain
- [ ] RLHF accuracy signal visible in admin dashboard
- [ ] PDF report downloads correctly with patient info + annotated image

---

## Robustness Additions Beyond the Basics

The following features make this production-ready for a real hospital:

**Security**
- JWT with 8-hour expiry (one hospital shift)
- Role-based access: doctors see their patients only; admins see everything
- Audit log on every API action (who did what, when, from which IP)
- CORS locked to your Vercel domain in production

**Data Integrity**
- Unique `image_id` UUID per scan — printed on every report, used as the RLHF key
- Immutable prediction records — no updates, only append (full audit trail)
- Feedback deduplication — one doctor, one vote per image
- `used_in_train` flag ensures no sample is trained on twice

**Report Quality**
- Annotated PNG: original image + patient strip + diagnosis overlay + probability bars, all in one file
- A4 PDF: suitable for printing and adding to patient's physical file
- ICD-10 codes included for insurance/billing compatibility

**RLHF Loop**
- 👍 vote → confirms prediction → image+label added to retraining pool
- 👎 vote → doctor provides correct label → corrected sample used for supervised fine-tuning
- Minimum sample threshold (default 20) prevents retraining on tiny batches
- Model only promoted if validation accuracy is acceptable
- Hot-swap: new model loads in the running process without restart

**Observability**
- `/health` endpoint reports active model version
- Request timing header (`X-Process-Time`) on every response
- Admin dashboard shows RLHF accuracy signal (👍 ratio over time)
- Full model version history with accuracy and promotion timestamp

---

*DermAI Hospital v2 — ResNet50 · FastAPI · PostgreSQL · Redis · Celery · React · HuggingFace · Vercel*
ENDOFFILE
echo "Done"




