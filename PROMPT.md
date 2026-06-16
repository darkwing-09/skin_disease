# 🏥 DermAI Hospital — Master Prompt Guide

All prompts are copy-paste ready. Each one triggers a specific implementation phase.  
Use them **in order** — each phase builds on the previous one.

---

## PHASE 0 — Project Kickoff

> **When to use:** The very first prompt. Sets the context and gets the complete Implementation.md.

```
I have a trained ResNet50 skin disease classifier saved as model_resnet50_klasifikasi.keras (10 classes: Eczema, Melanoma, Atopic Dermatitis, Basal Cell Carcinoma, Melanocytic Nevi, BKL, Psoriasis/Lichen Planus, Seborrheic Keratoses, Tinea/Fungal Infection, Warts/Viral Infection), the original training .ipynb notebook, and the dataset all in one folder.

My goal:
1. Build a full-stack hospital-grade backend using FastAPI
2. Deploy it on HuggingFace Spaces (Docker)
3. Add patient records, annotated diagnostic image reports (with all patient + diagnosis info printed ON the image), RLHF feedback loop (👍/👎 per prediction), and daily automated model retraining
4. Build a React frontend using Lovable or v0, deployed on Vercel
5. The whole system should feel like enterprise hospital software, not a consumer app

Write a complete Implementation.md guide covering: project structure, every backend file with full code, database schema (PostgreSQL), HuggingFace deployment steps, Lovable/v0 frontend prompt, Vercel deployment, environment variables, and end-to-end flow diagram.
```

---

## PHASE 1 — Local Project Setup

> **When to use:** After receiving Implementation.md. Sets up the local development environment.

```
I have the Implementation.md for my DermAI Hospital project. Now help me set up the local development environment step by step.

My trained model file is at: ./model_resnet50_klasifikasi.keras

Tasks:
1. Create the exact folder structure from Implementation.md (skin-disease-hospital-backend/)
2. Create ALL files: app.py, config.py, database.py, requirements.txt, Dockerfile, docker-compose.yml
3. Create all model ORM files: models/user.py, models/patient.py, models/prediction.py, models/feedback.py, models/model_version.py, models/audit_log.py
4. Create all schema files in schemas/
5. Create all service files: services/model_utils.py, services/report_generator.py, services/rlhf_engine.py, services/retraining_worker.py
6. Create middleware/audit_logger.py
7. Copy the model to data/models/model_v1.keras and create data/models/active_version.txt with content "v1"
8. Show me the exact terminal commands to run docker compose up --build and verify the API is working at http://localhost:7860/docs

Use the exact code from Implementation.md — do not simplify anything.
```

---

## PHASE 2 — Database Schema & First Test

> **When to use:** After docker compose up is running. Tests the DB and creates initial users.

```
My DermAI Hospital FastAPI backend is running at http://localhost:7860. The PostgreSQL database and Redis are up via docker-compose.

Now help me:
1. Verify all database tables were created automatically (SQLAlchemy create_all). Show me the SQL to check: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
2. Register the first admin user via the API:
   POST /auth/register with username=admin, email=admin@hospital.com, password=admin123, role=admin
3. Register a test doctor:
   POST /auth/register with username=drsmith, email=drsmith@hospital.com, password=doctor123, role=doctor
4. Login as admin and get a JWT token:
   POST /auth/login
5. Register a test patient:
   POST /patients/ with: full_name="John Doe", date_of_birth="1985-04-12", gender="Male", blood_group="B+"
6. Verify the patient was assigned a hospital ID like HOSP-2025-00001

Show me the exact curl commands and expected JSON responses for each step.
```

---

## PHASE 3 — Model Inference & Annotated Report Test

> **When to use:** After database is confirmed working. Tests the core AI prediction + report generation.

```
My DermAI Hospital backend is running. Database has admin user, doctor user, and a test patient HOSP-2025-00001.

Now test the full prediction pipeline:
1. Login as doctor (POST /auth/login) and save the JWT token
2. Upload a test skin image to POST /predict/ with:
   - patient_id: "HOSP-2025-00001"
   - file: [a skin image JPG]
   - doctor_notes: "Test scan for verification"
3. From the response, capture the image_id
4. Download and verify the annotated PNG report at GET /reports/{image_id}/image
   — The image should have: patient name, patient ID, diagnosis, ICD-10 code, severity badge, confidence %, probability bars, and model version stamped directly ON the image
5. Download and verify the A4 PDF report at GET /reports/{image_id}/pdf
6. Check the predictions table in PostgreSQL to confirm the record was saved with all fields

If the annotated image is missing fonts (fallback font used), show me how to add DejaVu fonts to the Dockerfile.

Show me exact curl commands for each step.
```

---

## PHASE 4 — RLHF Feedback Loop Test

> **When to use:** After a successful prediction. Tests the 👍/👎 RLHF feedback system.

```
I have a successful prediction with image_id: "REPLACE_WITH_YOUR_IMAGE_ID" in my DermAI Hospital backend.

Now test the RLHF feedback system:
1. Submit a 👍 upvote for this prediction:
   POST /feedback/ {image_id, vote: "up"}
   — Verify it returns success and will_be_used_for_training: true
2. Create a second test prediction with a different image
3. Submit a 👎 downvote for the second prediction with a corrected label:
   POST /feedback/ {image_id, vote: "down", correct_label: "Eczema", notes: "Model said Melanoma but this is clearly Eczema"}
4. Try submitting feedback twice for the same image — confirm it returns HTTP 409 (conflict)
5. Check the feedback table in PostgreSQL:
   SELECT vote, correct_label, used_in_train FROM feedback;
6. Check the admin dashboard stats:
   GET /admin/dashboard — verify total_upvotes, total_downvotes, accuracy_signal are all showing

Show me the exact curl commands and expected responses.
```

---

## PHASE 5 — Celery Worker & Daily Retrain Test

> **When to use:** After collecting at least 20 feedback samples. Tests the retraining pipeline.

```
My DermAI Hospital backend has collected feedback samples (upvotes and downvotes with correct labels). The Celery worker and beat are running.

Now test the daily retraining pipeline:
1. Verify the Celery worker is connected:
   docker compose logs worker --tail=20
2. Manually trigger retraining via the admin endpoint:
   POST /admin/trigger-retrain (requires admin JWT)
3. Watch the worker logs for:
   [RETRAIN] Starting daily retraining task...
   [RETRAIN] Fine-tuning on N samples...
   [RETRAIN] Saved: /app/data/models/model_v2.keras
   [RETRAIN] Promoted model: v2
4. Verify the new model version in the database:
   GET /admin/model-versions
5. Verify active_version.txt was updated:
   docker exec <container_name> cat /app/data/models/active_version.txt
6. Verify the health endpoint now shows v2:
   GET /health → {"status":"healthy","active_model":"v2"}
7. Run a new prediction and confirm it uses model_version: "v2" in the response

If there are fewer than 20 feedback samples, show me how to temporarily lower MIN_FEEDBACK_SAMPLES_FOR_RETRAIN to 5 in config.py for testing.
```

---

## PHASE 6 — HuggingFace Deployment

> **When to use:** After local testing is complete. Deploys the backend to HuggingFace Spaces.

```
My DermAI Hospital backend is fully working locally. Now I need to deploy it to HuggingFace Spaces using Docker SDK.

I plan to use:
- Supabase for PostgreSQL (free tier)
- Upstash for Redis (free tier)

Step-by-step help needed:
1. Create a Supabase project and get the DATABASE_URL connection string (what to click, what to copy)
2. Create an Upstash Redis and get the REDIS_URL (what to click, what to copy)
3. Create a HuggingFace Space named "dermai-hospital-api" with Docker SDK
4. Add all required secrets to the HuggingFace Space (list every secret I need to add)
5. Initialize git lfs and push my code:
   - git lfs install
   - git lfs track "*.keras"
   - push all files including model_v1.keras via LFS
6. Verify the Space builds successfully (what to look for in logs)
7. Test the live deployment:
   - GET /health
   - POST /auth/register (create first admin user on production)
   - POST /predict/ with a test image

Show me every command, every URL to visit, and every value to copy.
```

---

## PHASE 7 — Frontend Generation (Lovable / v0)

> **When to use:** After HuggingFace backend is live. Generates the React frontend.

```
My DermAI Hospital backend is live at:
https://YOUR_USERNAME-dermai-hospital-api.hf.space

I'm going to paste a prompt into Lovable (lovable.dev) to generate the full React hospital dashboard UI.

Before I do, confirm:
1. Which URL should I set as VITE_API_URL?
2. In the Lovable prompt, should I replace "YOUR_USERNAME" with my actual HuggingFace username?
3. After Lovable generates the project, what are the first 5 things I should check to verify it connected to my backend correctly?
4. If Lovable doesn't support some library in the prompt (like Recharts or Framer Motion), what's the fallback?
5. How do I test the login flow in the generated app?

Then paste the complete frontend prompt below exactly as written in the IMPLEMENTATION.md Section 9.
```

---

## PHASE 8 — Vercel Deployment

> **When to use:** After Lovable/v0 generates the frontend app. Deploys it to Vercel.

```
Lovable has generated my DermAI Hospital React frontend and I've exported it to a GitHub repository at: https://github.com/YOUR_USERNAME/dermai-hospital-frontend

Now deploy it to Vercel:
1. Walk me through connecting my GitHub repo to Vercel (what to click at vercel.com)
2. The framework should be detected as Vite — confirm the build command is: vite build
3. Add this environment variable in Vercel:
   VITE_API_URL = https://YOUR_USERNAME-dermai-hospital-api.hf.space
4. Create vercel.json in the repo root:
   {"rewrites": [{"source": "/(.*)", "destination": "/"}]}
5. Deploy and give me the live URL
6. Test the full end-to-end flow on the live Vercel URL:
   - Login with admin credentials
   - Register a new patient
   - Upload a skin scan image
   - View the annotated report image in the modal
   - Download the PDF report
   - Submit 👍 feedback
   - Check admin dashboard for RLHF stats
7. Show me how to update ALLOWED_ORIGINS in my HuggingFace secrets to only allow my Vercel domain

What exact steps, URLs, and commands do I need?
```

---

## PHASE 9 — End-to-End Smoke Test

> **When to use:** After both backend and frontend are live in production.

```
My DermAI Hospital system is fully deployed:
- Backend: https://YOUR_USERNAME-dermai-hospital-api.hf.space
- Frontend: https://your-app.vercel.app

Run a complete end-to-end smoke test. I want to verify EVERY feature works in production.

Test checklist:
[ ] 1. Health check: GET /health returns {"status":"healthy","active_model":"v1"}
[ ] 2. Admin login works on the frontend
[ ] 3. Doctor login works on the frontend
[ ] 4. Patient registration creates HOSP-YYYY-NNNNN format ID
[ ] 5. Patient list shows in the /patients page with search working
[ ] 6. New scan page: patient search autocomplete works
[ ] 7. Image upload: drag-and-drop works, preview shows
[ ] 8. Prediction runs and returns results within 10 seconds
[ ] 9. Annotated PNG has: patient name, patient ID, diagnosis, ICD-10, confidence %, severity badge, probability bars
[ ] 10. PDF downloads correctly and opens in browser PDF viewer
[ ] 11. 👍 feedback submits and shows confirmation toast
[ ] 12. 👎 feedback opens correct-label dropdown with all 10 disease classes
[ ] 13. Admin dashboard shows total_predictions, total_feedback, accuracy_signal
[ ] 14. Manual retrain trigger at POST /admin/trigger-retrain returns {"status":"queued"}
[ ] 15. Audit logs at GET /admin/audit-logs show prediction and feedback entries

For any test that fails, give me the exact debugging steps.
```

---

## PHASE 10 — Production Hardening

> **When to use:** After smoke test passes. Hardens the system for real hospital use.

```
My DermAI Hospital system is live and passing all smoke tests. Now I want to harden it for actual hospital deployment.

Please help me with these production hardening tasks:

1. SECURITY:
   - Lock ALLOWED_ORIGINS to only my Vercel domain (not *)
   - Generate a strong 256-bit SECRET_KEY: python -c "import secrets; print(secrets.token_hex(32))"
   - Set ACCESS_TOKEN_EXPIRE_MINUTES=480 (8-hour shift)
   - Add rate limiting to POST /predict/ (max 30 requests per minute per IP)

2. CORS & AUTH:
   - Confirm the frontend is NOT storing the JWT in localStorage (it should be in React context only)
   - Add a /auth/me endpoint to return the current user's profile

3. MONITORING:
   - Add a /metrics endpoint showing: total_predictions today, active_model, last_retrain timestamp
   - Show how to set up a UptimeRobot free monitor that pings GET /health every 5 minutes and emails me if it goes down

4. DATA BACKUP:
   - Show the SQL command to export the predictions table to CSV from Supabase dashboard
   - How to back up the model checkpoints from HuggingFace persistent volume

5. RETRAIN SCHEDULE:
   - How to change the retrain schedule from midnight to 2 AM: RETRAIN_SCHEDULE_HOUR=2
   - How to verify the Celery beat schedule is running correctly in production

Give me the exact code changes and commands for each item.
```

---

## UTILITY PROMPTS — Use Any Time

---

### U1 — Debug: "Model not loading"

```
My DermAI Hospital API is failing to load the model on startup. The error in HuggingFace logs is:
[paste your error here]

My model file is model_resnet50_klasifikasi.keras.
The active_version.txt contains "v1".
The expected model path is /app/data/models/model_v1.keras.

Diagnose the issue and give me the exact fix. Also show me how to verify the model file was correctly uploaded to HuggingFace via Git LFS (not as a pointer file).
```

---

### U2 — Debug: "Annotated image has no text / missing fonts"

```
My DermAI Hospital annotated report images are generating but showing no text overlay — the patient info, diagnosis, and probability bars are missing. The Pillow font loading is failing silently.

My Dockerfile is:
[paste your Dockerfile]

Fix the font loading in report_generator.py and Dockerfile so DejaVu fonts are available on the container. Show me the updated Dockerfile RUN command and the updated _load_font() function.
```

---

### U3 — Debug: "Celery worker not processing retraining"

```
My DermAI Hospital Celery worker is running but the daily_retrain_task is not being picked up. I triggered it manually via POST /admin/trigger-retrain and got a task_id back, but nothing happened.

Worker logs:
[paste your celery worker logs]

Diagnose and fix. Check:
1. Is the Celery broker URL (Redis) reachable from the worker container?
2. Is the task registered correctly?
3. Is the DATABASE_SYNC_URL set (not the async version) in the worker container?
```

---

### U4 — Add New Disease Class

```
I want to add a new disease class to my DermAI Hospital system: "Acne Vulgaris" (ICD-10: L70.0, severity: Low, action: "Prescribe benzoyl peroxide or retinoids. Skincare routine counseling.").

Show me every file I need to update:
1. services/model_utils.py — CLASS_NAMES list and CLASS_METADATA dict
2. schemas/prediction.py — if any hardcoded class lists
3. The re-training process to include the new class
4. How to update the frontend dropdown of diseases in the FeedbackWidget

Note: Adding a new class requires retraining the model from scratch with the new class in the dataset. Explain how to do that with the existing training notebook.
```

---

### U5 — Export Report Data for Doctor Review

```
My DermAI Hospital system has been running for 1 week. The head of dermatology wants a weekly CSV report of all predictions.

Write me:
1. A new admin endpoint GET /admin/export/predictions?start_date=2025-06-01&end_date=2025-06-07
   That returns a CSV with columns:
   image_id, patient_id, patient_name, doctor_name, top_prediction, confidence, severity, icd_code, feedback_vote, correct_label, model_version, created_at
2. The SQLAlchemy async query joining predictions + patients + users + feedback tables
3. The FastAPI FileResponse that returns the CSV with the correct Content-Disposition header
4. The frontend button in the Admin panel that calls this endpoint and triggers download
```

---

### U6 — Scale for Multiple Hospitals

```
My DermAI Hospital system is working for one hospital. The client wants to scale it to 5 hospitals, each with their own isolated data.

Design the multi-tenancy architecture:
1. Add a "hospital_id" UUID field to users, patients, predictions, and feedback tables
2. Update all queries to filter by the logged-in user's hospital_id
3. Add hospital registration and a "super_admin" role above "admin"
4. Update the JWT payload to include hospital_id
5. Show the Alembic migration commands to add hospital_id to all tables without losing existing data
6. How should the frontend URL structure change? (e.g., hospital.dermai.com/login vs. dermai.com/hospital-A/login)
```

---

### U7 — Add Confidence Threshold Alert

```
I want to add a clinical safety feature to DermAI Hospital: if the model's top confidence is below 60%, automatically flag the prediction as "Low Confidence" and send an alert.

Add:
1. A "confidence_flag" field to the predictions table ("normal" | "low_confidence" | "uncertain")
2. Logic in predictions.py: if confidence < 60%, set confidence_flag = "low_confidence"
3. A new email alert (using Python's smtplib or sendgrid) to the assigned doctor when confidence_flag = "low_confidence"
4. A visual warning banner on the frontend scan result page when confidence < 60%: "⚠ Low Confidence — Manual review strongly recommended"
5. A filter in the admin dashboard to show all low-confidence predictions from the past 7 days

Show complete code for each change.
```

---

### U8 — Add Alembic Migrations

```
My DermAI Hospital database was created using SQLAlchemy create_all(). I want to switch to proper Alembic migrations for production database management so I can make schema changes safely.

Set up Alembic:
1. Install alembic (already in requirements.txt)
2. alembic init alembic — show the exact alembic.ini and env.py configuration for my async PostgreSQL setup
3. Generate the initial migration from my existing models:
   alembic revision --autogenerate -m "initial_schema"
4. Apply the migration:
   alembic upgrade head
5. Show how to create a future migration when I add a new column (e.g., adding "allergies" to the patients table)
6. Add alembic upgrade head to the Dockerfile CMD or lifespan startup so migrations run automatically on deploy

Show every file and command.
```

---

## PHASE SUMMARY TABLE

| Phase | What Gets Built | Key Output |
|-------|----------------|------------|
| Phase 0 | Project plan | Implementation.md |
| Phase 1 | Full local project scaffold | All backend files created |
| Phase 2 | Database + first users | Admin + doctor accounts in DB |
| Phase 3 | AI prediction + report | Annotated PNG + PDF download |
| Phase 4 | RLHF feedback | 👍/👎 stored in feedback table |
| Phase 5 | Daily retrain pipeline | model_v2.keras promoted |
| Phase 6 | HuggingFace deployment | Live backend URL |
| Phase 7 | Frontend generation | React app from Lovable/v0 |
| Phase 8 | Vercel deployment | Live frontend URL |
| Phase 9 | End-to-end smoke test | All 15 features verified |
| Phase 10 | Production hardening | Security + monitoring + backup |

---

*DermAI Hospital — ResNet50 · FastAPI · PostgreSQL · Redis · Celery · React · HuggingFace · Vercel*
