---
title: DermAI Hospital API
emoji: 🏥
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---

# DermAI Hospital API

Hospital-grade skin disease detection API with patient records, annotated diagnostic image reports, RLHF feedback loop, and automated daily model retraining.

## Local Development

1. Copy `.env.example` to `.env` and configure variables.
2. Build and run docker-compose:
   ```bash
   docker compose up --build
   ```

## Default Admin

On startup, the API creates or updates one admin account:

```text
username: hospital_admin
password: SecurePassword2026!
```

Override these with environment variables in production:

```text
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_PASSWORD
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_FULL_NAME
DEFAULT_ADMIN_DEPARTMENT
DEFAULT_ADMIN_ENABLED
```

## Production Deployment (HuggingFace Spaces + Supabase + Upstash)

Refer to the deployment instructions in the guide.
