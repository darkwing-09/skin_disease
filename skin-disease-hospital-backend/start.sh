#!/bin/bash
# Start Celery worker in the background
echo "[STARTUP] Starting Celery worker..."
celery -A services.retraining_worker.celery_app worker --loglevel=info &

# Start Celery beat in the background
echo "[STARTUP] Starting Celery beat..."
celery -A services.retraining_worker.celery_app beat --loglevel=info &

# Start Uvicorn API in the foreground
echo "[STARTUP] Starting Uvicorn API..."
exec uvicorn app:app --host 0.0.0.0 --port 7860 --workers 1
