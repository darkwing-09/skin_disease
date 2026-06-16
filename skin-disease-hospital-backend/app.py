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
