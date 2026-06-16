# Skin Disease Detection Hospital System

This repository contains the DermAI Hospital frontend and FastAPI backend source.

## Structure

- `dermai-hospital/` - React, TypeScript, Vite frontend for doctors/admin users.
- `skin-disease-hospital-backend/` - FastAPI backend, model inference, reporting, patients, feedback, and admin APIs.
- `Frontend/` and root markdown files - implementation notes and project documentation.

## Files intentionally not tracked

Large/generated/private files are excluded from Git:

- `node_modules/`
- frontend `dist/`
- `.env` files
- backend generated `data/`
- Keras/model artifacts such as `*.keras`
- uploaded test/report images and PDFs

For backend runtime, place the model at:

```text
skin-disease-hospital-backend/data/models/model_v1.keras
```

or configure `INITIAL_MODEL_PATH` and `MODELS_DIR` in the backend environment.

## Frontend: local setup

```bash
cd dermai-hospital
cp .env.example .env
npm ci
npm run dev
```

## Frontend: Vercel setup

In Vercel, import this GitHub repository and configure:

- Root Directory: `dermai-hospital`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_API_URL`

Current backend URL used locally:

```text
https://varundevmishra09-dermai-hospital-api.hf.space
```

## Backend: local setup

```bash
cd skin-disease-hospital-backend
cp .env.example .env
docker compose up --build
```

The backend is designed for Docker/Hugging Face Spaces style hosting because model inference and report generation need server-side Python dependencies.
