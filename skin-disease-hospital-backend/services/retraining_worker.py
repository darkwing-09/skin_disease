"""
Celery beat task for nightly model retraining.
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
    """Main Celery retrain task."""
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
        msg = (f"[RETRAIN] Only {len(samples)} samples — "
               f"minimum {settings.MIN_FEEDBACK_SAMPLES_FOR_RETRAIN} required. Skipping.")
        logger.info(msg)
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
    val_acc = float(history.history.get("val_accuracy", [0])[-1]) if len(X_val) > 0 else None

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
